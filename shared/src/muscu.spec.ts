import { groupSets, nextWorkout, volume } from './muscu.js';

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
