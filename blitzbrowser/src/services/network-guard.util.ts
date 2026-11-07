// Keeps the pages Chrome renders from reaching private or reserved networks.
//
// Every request Chrome makes goes through this instance's local proxy-chain
// server (--proxy-server, with --proxy-bypass-list=<-loopback> so loopback is
// proxied too). That includes redirect hops, iframes, workers and WebSockets,
// which a CDP client's request interception can't all see. The proxy:
//   1. refuses targets that are blocked by name alone (localhost, private IP
//      literals, single-label names such as Docker service names), and
//   2. connects through guardedLookup, which refuses a hostname whose DNS
//      answer contains a private address. The check runs on the address the
//      socket actually connects to, so DNS rebinding can't slip past it.
//
// Set ALLOW_PRIVATE_NETWORKS=true to turn this off (e.g. to scan an intranet).
import { BlockList, isIP } from 'net';
import * as dns from 'dns';

const BLOCKED = new BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12], // private (Docker's default bridge ranges too)
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
] as const) BLOCKED.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64
  ['fc00::', 7], // unique-local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) BLOCKED.addSubnet(addr, prefix, 'ipv6');

/**
 * Extra ranges to refuse, e.g. the host's own public IP: from inside the
 * container it reaches services the cloud firewall hides from the internet
 * (Coolify on :8000), and it isn't a private address. Comma-separated CIDRs
 * or bare IPs: BLOCKED_CIDRS=178.104.34.227/32,2a01:4f8::/64
 */
export function addBlockedCidrs(list: string | undefined, target: BlockList = BLOCKED): string[] {
  const added: string[] = [];
  for (const raw of (list ?? '').split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    const [addr, bits] = entry.split('/');
    const version = isIP(addr);
    if (version === 0) throw new Error(`BLOCKED_CIDRS: '${entry}' is not an IP or CIDR`);
    const prefix = bits === undefined ? (version === 4 ? 32 : 128) : parseInt(bits, 10);
    target.addSubnet(addr, prefix, version === 4 ? 'ipv4' : 'ipv6');
    added.push(`${addr}/${prefix}`);
  }
  return added;
}
addBlockedCidrs(process.env.BLOCKED_CIDRS);

export const PRIVATE_NETWORKS_ALLOWED = process.env.ALLOW_PRIVATE_NETWORKS === 'true';

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return false;
  return BLOCKED.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}

/** True when the target is refused by its name alone, before any DNS. */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (isIP(h)) return isPrivateIp(h);
  return !h.includes('.');
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;

/**
 * dns.lookup replacement for proxy-chain's outgoing connections: resolves
 * normally, then fails if any returned address is private.
 */
export function createGuardedLookup(baseLookup: typeof dns.lookup = dns.lookup) {
  return function guardedLookup(hostname: string, options: unknown, callback?: unknown): void {
    const cb = (typeof options === 'function' ? options : callback) as LookupCallback;
    const opts: dns.LookupOptions = typeof options === 'object' && options !== null ? (options as dns.LookupOptions) : typeof options === 'number' ? { family: options } : {};
    baseLookup(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return cb(err);
      const list = addresses as dns.LookupAddress[];
      const blocked = list.find((a) => isPrivateIp(a.address));
      if (blocked) {
        const error: NodeJS.ErrnoException = new Error(`Blocked private address ${blocked.address} for ${hostname}`);
        error.code = 'EBLOCKEDPRIVATE';
        return cb(error);
      }
      if (opts.all) return cb(null, list);
      const first = list[0];
      if (!first) {
        const error: NodeJS.ErrnoException = new Error(`No address for ${hostname}`);
        error.code = 'ENOTFOUND';
        return cb(error);
      }
      return cb(null, first.address, first.family);
    });
  } as unknown as typeof dns.lookup;
}

export const guardedLookup = createGuardedLookup();
