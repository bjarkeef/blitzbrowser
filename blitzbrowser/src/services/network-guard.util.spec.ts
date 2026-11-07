import * as dns from 'dns';
import { BlockList } from 'net';
import { addBlockedCidrs, createGuardedLookup, isBlockedHostname, isPrivateIp } from './network-guard.util';

describe('addBlockedCidrs', () => {
  it('adds bare IPs and CIDRs', () => {
    const list = new BlockList();
    expect(addBlockedCidrs(' 178.104.34.227 , 2a01:4f8::/64', list)).toEqual(['178.104.34.227/32', '2a01:4f8::/64']);
    expect(list.check('178.104.34.227', 'ipv4')).toBe(true);
    expect(list.check('178.104.34.228', 'ipv4')).toBe(false);
    expect(list.check('2a01:4f8::1', 'ipv6')).toBe(true);
  });
  it('ignores an empty value and rejects garbage', () => {
    expect(addBlockedCidrs(undefined, new BlockList())).toEqual([]);
    expect(() => addBlockedCidrs('not-an-ip', new BlockList())).toThrow(/BLOCKED_CIDRS/);
  });
});

describe('isPrivateIp', () => {
  it.each(['169.254.169.254', '10.0.1.5', '127.0.0.1', '172.17.0.1', '192.168.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1'])('blocks %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });
  it.each(['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111'])('allows %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe('isBlockedHostname', () => {
  it.each(['localhost', 'app.localhost', '169.254.169.254', '10.0.1.5', '[::1]', 'coolify', 'coolify-db', 'blitzbrowser.'])('blocks %s', (h) => {
    expect(isBlockedHostname(h)).toBe(true);
  });
  it.each(['example.com', 'www.sitecheck.dk', '93.184.216.34'])('allows %s', (h) => {
    expect(isBlockedHostname(h)).toBe(false);
  });
});

describe('createGuardedLookup', () => {
  const table: Record<string, dns.LookupAddress[]> = {
    'public.example': [{ address: '93.184.216.34', family: 4 }],
    'rebind.example': [{ address: '93.184.216.34', family: 4 }, { address: '10.0.1.5', family: 4 }],
    'meta.example': [{ address: '169.254.169.254', family: 4 }],
  };
  const base = ((hostname: string, _opts: unknown, cb: (e: Error | null, a?: dns.LookupAddress[]) => void) => {
    const hit = table[hostname];
    if (!hit) return cb(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    cb(null, hit);
  }) as unknown as typeof dns.lookup;
  const lookup = createGuardedLookup(base);
  const run = (host: string, opts: dns.LookupOptions = {}) =>
    new Promise<{ err: NodeJS.ErrnoException | null; address?: unknown; family?: number }>((res) =>
      (lookup as unknown as (h: string, o: unknown, cb: LookupCb) => void)(host, opts, (err, address, family) => res({ err, address, family })),
    );
  type LookupCb = (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) => void;

  it('returns the public address', async () => {
    expect(await run('public.example')).toEqual({ err: null, address: '93.184.216.34', family: 4 });
  });
  it('returns all addresses when asked', async () => {
    const r = await run('public.example', { all: true });
    expect(r.address).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
  it.each(['rebind.example', 'meta.example'])('refuses %s, which resolves to a private address', async (host) => {
    const r = await run(host);
    expect(r.err?.code).toBe('EBLOCKEDPRIVATE');
  });
  it('passes DNS errors through', async () => {
    expect((await run('nope.example')).err?.code).toBe('ENOTFOUND');
  });
});
