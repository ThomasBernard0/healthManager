import { entryPreFatigue, type SessionEntry } from './progression.service.js';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 10, 8, minute));
const entry = (
  id: string,
  primaryMuscles: SessionEntry['exercise']['primaryMuscles'],
  secondaryMuscles: SessionEntry['exercise']['secondaryMuscles'],
  doneAt: (number | null)[],
): SessionEntry => ({
  id,
  firstSetAt: doneAt.find((m) => m !== null) !== undefined ? at(doneAt.find((m) => m !== null)!) : null,
  exercise: { primaryMuscles, secondaryMuscles },
  sets: doneAt.map((m) => ({ done: m !== null, doneAt: m === null ? null : at(m) })),
});

describe('entryPreFatigue (order of the session)', () => {
  const dips = entry('dips', ['chest'], ['triceps'], [0, 3, 6, null]);
  const curls = entry('curls', ['biceps'], ['forearms'], [10, 12, 14, 16]);

  it('not started yet: every set validated so far on its primary muscles', () => {
    const bench = entry('bench', ['chest'], ['triceps'], [null, null, null, null]);
    expect(entryPreFatigue(bench, [dips, curls, bench])).toEqual({ value: 3, muscles: ['chest'] });
  });

  it('started: only the sets validated before its first set count', () => {
    const bench = entry('bench', ['chest'], ['triceps'], [4, 8, null, null]);
    // Dips: sets at 0 and 3 were before the bench press (4); the one at 6 came after.
    expect(entryPreFatigue(bench, [dips, curls, bench]).value).toBe(2);
  });

  it('done first: no pre-fatigue', () => {
    const bench = entry('bench', ['chest'], ['triceps'], [-5, null, null, null]);
    expect(entryPreFatigue(bench, [dips, curls, bench])).toEqual({ value: 0, muscles: [] });
  });
});
