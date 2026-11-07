# About this fork

This is the BlitzBrowser image the SiteCheck scan pipeline runs on.

## Provenance

- It is based on upstream BlitzBrowser `1.6.0` (commit `3e86847`, 2026-03-03).
- The upstream repository (`github.com/blitzbrowser/blitzbrowser`) and its docs site are gone; only its GHCR images remain.
- GitHub lists this repo as a fork of `freshy969/blitzbrowser`. That is a mirror account's January snapshot, not the upstream, so don't sync from it.

## What we changed

- **Reaper:** every browser instance is closed after `BROWSER_MAX_LIFETIME_MS` (1 h by default), so leaked instances can't fill the pool.
- **Pool status:** `GET /browser-pool` also returns `active_instances`, `oldest_age_ms` and `instances[]`.
- **Network guard** (`src/services/network-guard.util.ts`): the per-instance proxy refuses private, reserved, loopback and single-label targets, including redirect hops, iframes and WebSockets. It checks the address it actually connects to, so DNS rebinding can't get past it. Set `BLOCKED_CIDRS` to add the host's own public IP. Set `ALLOW_PRIVATE_NETWORKS=true` to turn the guard off.
- **Chrome's DevTools port** is bound to `127.0.0.1` only.
- **Fails closed:** the server refuses to start without `API_KEY`, unless `ALLOW_NO_API_KEY=true` is set.
- **Chrome is pinned on its own** (`CHROME_VERSION` in the Dockerfile, a Chrome for Testing stable build). That way a Chrome security release doesn't have to wait for a Puppeteer release.

## Updating

1. Bump `CHROME_VERSION` in `blitzbrowser/Dockerfile` to the current Chrome for Testing stable. Check https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json.
2. When bumping Puppeteer, change the `FROM ghcr.io/puppeteer/puppeteer:<v>` tag and the `puppeteer` dependency together, then run `npm install` to refresh `package-lock.json`.
3. Bump `version` in `blitzbrowser/package.json`, then run the CI/CD workflow. `latest` only moves on `main`; deploy by the version tag.
