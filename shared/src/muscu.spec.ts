import {
  averageWeight,
  barKind,
  blockStatus,
  chartBarValue,
  groupSets,
  interleaveSets,
  loadKind,
  nextWorkout,
  toBlocks,
  unlinkSuperset,
  validSupersetGroups,
  volume,
} from './muscu.js';

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

describe('assistance (bodyweight exercises)', () => {
  const assisted = [9, 9, 8, 8].map((reps) => ({ weight: -20, reps }));

  it('compact format: help below 0, the body alone at 0, a load above (or on any other equipment)', () => {
    expect(loadKind(-20, true)).toBe('assist');
    expect(loadKind(0, true)).toBe('bodyweight');
    expect(loadKind(5, true)).toBe('load');
    expect(loadKind(0, false)).toBe('load');
    expect(groupSets(assisted)).toEqual([{ weight: -20, reps: [9, 9, 8, 8] }]);
  });

  it('chart bar: total reps for a bodyweight exercise, volume for the others', () => {
    expect(barKind('bodyweight')).toBe('reps');
    expect(barKind('barbell')).toBe('volume');
    expect(chartBarValue(assisted, 'bodyweight')).toBe(34);
    expect(chartBarValue([12, 12, 11, 10].map((reps) => ({ weight: 57.5, reps })), 'barbell')).toBe(2587.5);
  });

  it('a 0 kg session is not a zero bar', () => {
    expect(chartBarValue([9, 8, 8, 8].map((reps) => ({ weight: 0, reps })), 'bodyweight')).toBe(33);
  });

  it('chart line: the average weight weighted by reps, signed for help', () => {
    const tractions = [{ weight: -32, reps: 5 }, ...[10, 10, 10].map((reps) => ({ weight: -41, reps }))];
    expect(averageWeight(tractions)).toBeCloseTo(-(5 * 32 + 30 * 41) / 35);
    expect(averageWeight(tractions)).toBeCloseTo(-39.71, 2);
    expect(averageWeight([{ weight: 60, reps: 10 }, { weight: 50, reps: 10 }])).toBe(55);
    expect(averageWeight([{ weight: 60, reps: 0 }])).toBe(60);
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

describe('superset blocks', () => {
  const item = (id: string, group: string | null = null, sets = 4) => ({ id, group, sets, repMin: 8, repMax: 12 });
  const ids = (items: { id: string }[]) => items.map((i) => i.id).join('');

  it('shows one block (one card) for the pair', () => {
    const list = [item('a'), item('b', 'g'), item('c', 'g'), item('d')];
    expect(toBlocks(list).map(ids)).toEqual(['a', 'bc', 'd']);
    expect(toBlocks([item('a', 'g'), item('b', 'h'), item('c', 'h')]).map(ids)).toEqual(['a', 'bc']);
  });

  it('unlinking keeps both exercises, their targets and their order', () => {
    const list = [item('a'), item('b', 'g', 3), item('c', 'g'), item('d', 'h'), item('e', 'h')];
    expect(unlinkSuperset(list, 'g')).toEqual([item('a'), item('b', null, 3), item('c'), item('d', 'h'), item('e', 'h')]);
  });

  it('the pair gets ✓ only when both exercises are done', () => {
    expect(blockStatus(['done', 'done'])).toBe('done');
    expect(blockStatus(['done', 'inProgress'])).toBe('inProgress');
    expect(blockStatus(['done', 'todo'])).toBe('inProgress');
    expect(blockStatus(['todo', 'todo'])).toBe('todo');
    expect(blockStatus(['done'])).toBe('done');
  });
});
