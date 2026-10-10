import { nextWorkout } from './muscu.js';

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
