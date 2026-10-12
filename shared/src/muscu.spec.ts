import { groupSets, interleaveSets, nextWorkout, validSupersetGroups, volume } from './muscu.js';

describe('nextWorkout', () => {
  const pushA = { id: 'a', position: 1 };
  const pull = { id: 'p', position: 2 };
  const pushB = { id: 'b', position: 3 };
  const rotation = [pushB, pushA, pull];

  it('after Push A proposes Pull; after Push B, Push A (wraps around)', () => {
    expect(nextWorkout(rotation, 'a')).toBe(pull);
    expect(nextWorkout(rotation, 'p')).toBe(pushB);
    expect(nextWorkout(rotation, 'b')).toBe(pushA);
  });

  it('starts with the first workout when nothing was done, or the last one was deleted', () => {
    expect(nextWorkout(rotation, null)).toBe(pushA);
    expect(nextWorkout(rotation, 'deleted')).toBe(pushA);
    expect(nextWorkout([], null)).toBeNull();
  });
});

describe('groupSets', () => {
  it('groups consecutive sets at the same weight', () => {
    expect(groupSets([60, 60, 60, 60].map((weight, i) => ({ weight, reps: [10, 9, 9, 8][i] })))).toEqual([
      { weight: 60, reps: [10, 9, 9, 8] },
    ]);
  });

  it('starts a new group on a weight change (drop set)', () => {
    expect(
      groupSets([
        { weight: 57.5, reps: 11 },
        { weight: 57.5, reps: 10 },
        { weight: 55, reps: 10 },
        { weight: 55, reps: 9 },
      ]),
    ).toEqual([
      { weight: 57.5, reps: [11, 10] },
      { weight: 55, reps: [10, 9] },
    ]);
    expect(groupSets([])).toEqual([]);
  });

  it('sums the volume', () => {
    expect(volume([{ weight: 57.5, reps: 12 }, { weight: 57.5, reps: 12 }, { weight: 57.5, reps: 11 }, { weight: 57.5, reps: 10 }])).toBe(2587.5);
  });
});

describe('interleaveSets', () => {
  const sets = (n: number) => Array.from({ length: n }, (_, i) => i);
  const labels = (a: number, b: number) =>
    interleaveSets(sets(a), sets(b))
      .map((s) => `${s.exercise.toUpperCase()}${s.index + 1}`)
      .join(' ');

  it('alternates the sets of two exercises with the same set count', () => {
    expect(labels(4, 4)).toBe('A1 B1 A2 B2 A3 B3 A4 B4');
  });

  it('ends with the remaining sets of the longer exercise', () => {
    expect(labels(4, 3)).toBe('A1 B1 A2 B2 A3 B3 A4');
    expect(labels(4, 2)).toBe('A1 B1 A2 B2 A3 A4');
    expect(labels(2, 4)).toBe('A1 B1 A2 B2 B3 B4');
  });

  it('keeps each set with its index', () => {
    expect(interleaveSets(['x'], ['y'])).toEqual([
      { exercise: 'a', index: 0, set: 'x' },
      { exercise: 'b', index: 0, set: 'y' },
    ]);
  });
});

describe('validSupersetGroups', () => {
  it('accepts solo items and pairs of adjacent items', () => {
    expect(validSupersetGroups([])).toBe(true);
    expect(validSupersetGroups([null, null])).toBe(true);
    expect(validSupersetGroups([null, 'g', 'g', null])).toBe(true);
    expect(validSupersetGroups(['g', 'g', 'h', 'h'])).toBe(true);
  });

  it('rejects a group of 1 or 3 items', () => {
    expect(validSupersetGroups(['g', null])).toBe(false);
    expect(validSupersetGroups([null, 'g'])).toBe(false);
    expect(validSupersetGroups(['g', 'g', 'g'])).toBe(false);
  });

  it('rejects two items that are not adjacent', () => {
    expect(validSupersetGroups(['g', null, 'g'])).toBe(false);
    expect(validSupersetGroups(['g', 'h', 'g', 'h'])).toBe(false);
  });
});
