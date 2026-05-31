import { findStaleInstanceIds, type ReapableInstance } from './browser-reaper.util';

const at = (iso: string): ReapableInstance => ({ id: iso, created_at: iso, in_use: false });

describe('findStaleInstanceIds', () => {
  const now = Date.parse('2026-05-30T12:00:00.000Z');
  const oneHour = 3_600_000;

  it('returns ids of instances older than the max lifetime', () => {
    const instances = [
      at('2026-05-30T11:59:00.000Z'), // 1 min old  -> keep
      at('2026-05-30T10:00:00.000Z'), // 2 h old    -> reap
    ];
    expect(findStaleInstanceIds(instances, now, oneHour)).toEqual(['2026-05-30T10:00:00.000Z']);
  });

  it('reaps even when the instance is in_use (max lifetime is a hard cap)', () => {
    const old = { id: 'x', created_at: '2026-05-30T09:00:00.000Z', in_use: true };
    expect(findStaleInstanceIds([old], now, oneHour)).toEqual(['x']);
  });

  it('returns nothing when disabled (maxLifetimeMs <= 0)', () => {
    const old = at('2020-01-01T00:00:00.000Z');
    expect(findStaleInstanceIds([old], now, 0)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(findStaleInstanceIds([], now, oneHour)).toEqual([]);
  });
});
