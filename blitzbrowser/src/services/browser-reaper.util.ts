export interface ReapableInstance {
  id: string;
  created_at: string;
  in_use: boolean;
}

/**
 * Returns the ids of instances whose age exceeds maxLifetimeMs. Max lifetime is
 * a hard cap: in_use is ignored on purpose (a scan never legitimately needs a
 * browser longer than the cap, and a stuck in_use instance is exactly the zombie
 * we must reap). maxLifetimeMs <= 0 disables reaping entirely.
 */
export function findStaleInstanceIds(
  instances: ReapableInstance[],
  nowMs: number,
  maxLifetimeMs: number,
): string[] {
  if (maxLifetimeMs <= 0) return [];
  return instances
    .filter((i) => nowMs - new Date(i.created_at).getTime() > maxLifetimeMs)
    .map((i) => i.id);
}
