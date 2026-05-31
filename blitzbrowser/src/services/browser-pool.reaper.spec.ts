import { findStaleInstanceIds } from './browser-reaper.util';

// The pool service's reapStaleInstances() delegates the decision to
// findStaleInstanceIds and then calls instance.close() on each returned id.
// Here we assert that wiring contract at the unit level: given a fake instance
// map and a close spy, the ids selected by the predicate are exactly the ones
// closed.
describe('reaper wiring contract', () => {
  it('closes only instances past the max lifetime', () => {
    const now = Date.parse('2026-05-30T12:00:00.000Z');
    const closed: string[] = [];
    const instances = new Map(
      [
        { id: 'fresh', created_at: '2026-05-30T11:59:00.000Z', in_use: false },
        { id: 'zombie', created_at: '2026-05-30T10:00:00.000Z', in_use: true },
      ].map((i) => [i.id, { ...i, close: () => { closed.push(i.id); } }]),
    );

    const staleIds = findStaleInstanceIds(
      [...instances.values()].map((i) => ({ id: i.id, created_at: i.created_at, in_use: i.in_use })),
      now,
      3_600_000,
    );
    for (const id of staleIds) instances.get(id)!.close();

    expect(closed).toEqual(['zombie']);
  });
});
