import {
  DEFAULT_STEP,
  judge,
  nextTargets,
  preFatigue,
  stepDown,
  stepUp,
  type ExerciseLog,
  type Feeling,
  type NextTargetsInput,
} from './progression.js';

/** A past session: weight (one for all sets, or one per set), reps done, feeling, targets. */
function log(
  weight: number | number[],
  reps: number[],
  feeling: Feeling | null = 'ok',
  options: { targets?: number[]; preFatigue?: number; complete?: boolean; inSuperset?: boolean } = {},
): ExerciseLog {
  return {
    sets: reps.map((r, i) => {
      const w = Array.isArray(weight) ? weight[i] : weight;
      return { weight: w, reps: r, targetWeight: options.targets ? w : null, targetReps: options.targets?.[i] ?? null };
    }),
    feeling,
    preFatigue: options.preFatigue ?? 0,
    complete: options.complete ?? true,
    inSuperset: options.inSuperset ?? false,
  };
}

/** 4 × 8–12 barbell, nothing else known. */
const next = (last: ExerciseLog | null, extra: Partial<NextTargetsInput> = {}) =>
  nextTargets({
    last,
    previous: null,
    setCount: 4,
    repMin: 8,
    repMax: 12,
    known: last ? last.sets.map((s) => s.weight) : [],
    step: DEFAULT_STEP.barbell,
    todayPreFatigue: 0,
    ...extra,
  });

const weights = (t: ReturnType<typeof nextTargets>) => t!.map((x) => x.weight);
const reps = (t: ReturnType<typeof nextTargets>) => t!.map((x) => x.reps);

describe('stepUp / stepDown (available weights, learned)', () => {
  it('default step by equipment', () => {
    expect(DEFAULT_STEP).toEqual({ barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, bodyweight: 2.5 });
  });

  it('no known weight above: current + step', () => {
    expect(stepUp(8, [8], DEFAULT_STEP.machine)).toBe(13);
    expect(stepUp(10, [10], DEFAULT_STEP.dumbbell)).toBe(12);
  });

  it('known {8, 30}: stepping up from 8 (machine) gives 13, not 30 (too far)', () => {
    expect(stepUp(8, [8, 30], DEFAULT_STEP.machine)).toBe(13);
  });

  it('dumbbells 10 kg "Facile", user logged 12,5: a step up from 10 gives 12,5', () => {
    expect(stepUp(10, [10, 12.5], DEFAULT_STEP.dumbbell)).toBe(12.5);
  });

  it('a typo fixed in a past set is no longer a known weight', () => {
    // 600 typed instead of 60, then fixed: known weights are read from the sets again.
    expect(stepUp(60, [57.5, 60], 2.5)).toBe(62.5);
  });

  it('stepDown mirrors it and never goes below 0', () => {
    expect(stepDown(13, [8, 13], DEFAULT_STEP.machine)).toBe(8);
    expect(stepDown(12.5, [10, 12.5], DEFAULT_STEP.dumbbell)).toBe(10);
    expect(stepDown(30, [8, 30], DEFAULT_STEP.machine)).toBe(25);
    expect(stepDown(2, [], DEFAULT_STEP.machine)).toBe(0);
  });
});

describe('pre-fatigue', () => {
  const bench = { primaryMuscles: ['chest'] as const, secondaryMuscles: ['triceps', 'shoulders_front'] as const };
  const dips = { primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] } as const;
  const curls = { primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'] } as const;
  const pushdown = { primaryMuscles: ['triceps'], secondaryMuscles: ['chest'] } as const;
  const b = { primaryMuscles: [...bench.primaryMuscles], secondaryMuscles: [...bench.secondaryMuscles] };
  const e = (x: typeof dips | typeof curls | typeof pushdown, sets: number) => ({
    primaryMuscles: [...x.primaryMuscles],
    secondaryMuscles: [...x.secondaryMuscles],
    sets,
  });

  it('bench press after 3 sets of dips → 3; after curls → 0; with dips skipped → 0', () => {
    expect(preFatigue(b, [e(dips, 3)])).toEqual({ value: 3, muscles: ['chest'] });
    expect(preFatigue(b, [e(curls, 4)])).toEqual({ value: 0, muscles: [] });
    expect(preFatigue(b, [e(dips, 0)])).toEqual({ value: 0, muscles: [] });
  });

  it('superset partner on independent muscles → 0, whatever its sets done earlier', () => {
    const laterals = { primaryMuscles: ['shoulders_side' as const], secondaryMuscles: [] };
    const pushdownOnly = { primaryMuscles: ['triceps' as const], secondaryMuscles: [] };
    expect(preFatigue(laterals, [{ ...pushdownOnly, sets: 2 }])).toEqual({ value: 0, muscles: [] });
  });

  it('superset partner sharing only a secondary muscle, 2 earlier sets → 1', () => {
    expect(preFatigue(b, [e(pushdown, 2)])).toEqual({ value: 1, muscles: ['chest'] });
  });

  it('½ per set when the shared muscle is only secondary in the earlier exercise', () => {
    expect(preFatigue(b, [e(pushdown, 4), e(curls, 3)]).value).toBe(2);
  });
});

describe('judge and nextTargets (double progression, 4 × 8–12)', () => {
  it('first time: no target', () => {
    expect(next(null)).toBeNull();
  });

  it('50 kg, done 12·12·12·8 (total 44) → one step up, targets × 8·8·8·8', () => {
    const t = next(log(50, [12, 12, 12, 8]));
    expect(weights(t)).toEqual([52.5, 52.5, 52.5, 52.5]);
    expect(reps(t)).toEqual([8, 8, 8, 8]);
  });

  it('done 11·11·11·10 (total 43) "OK" → 50 × 12·12·12·11; done as targeted (47) → step up the time after', () => {
    const t = next(log(50, [11, 11, 11, 10]));
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([12, 12, 12, 11]);
    expect(judge(log(50, [12, 12, 12, 11], 'ok', { targets: [12, 12, 12, 11] }), null, 8, 12)).toBe('up');
  });

  it('done 12·12·12·7 (total 43) "OK" → 50 × 12·12·12·8; never counts toward a drop', () => {
    const last = log(50, [12, 12, 12, 7]);
    expect(reps(next(last))).toEqual([12, 12, 12, 8]);
    expect(judge(last, log(50, [7, 7, 6, 6]), 8, 12)).toBe('progress');
  });

  it('target 50 × 10·10·10·10, done 10·10·10·8 "OK" → 50 × 11·11·11·9; "Dur" → 50 × 10·10·10·10', () => {
    const targets = [10, 10, 10, 10];
    expect(reps(next(log(50, [10, 10, 10, 8], 'ok', { targets })))).toEqual([11, 11, 11, 9]);
    const hard = next(log(50, [10, 10, 10, 8], 'hard', { targets }));
    expect(weights(hard)).toEqual([50, 50, 50, 50]);
    expect(reps(hard)).toEqual([10, 10, 10, 10]);
  });

  it('reps rebalance: 10·10·10·8 → 11·11·11·9 → 12·12·12·10 (total 46) → next weight', () => {
    const second = next(log(50, [10, 10, 10, 8]))!;
    expect(reps(second)).toEqual([11, 11, 11, 9]);
    const third = next(log(50, reps(second), 'ok', { targets: reps(second) }))!;
    expect(reps(third)).toEqual([12, 12, 12, 10]);
    const fourth = next(log(50, reps(third), 'ok', { targets: reps(third) }));
    expect(weights(fourth)).toEqual([52.5, 52.5, 52.5, 52.5]);
    expect(reps(fourth)).toEqual([8, 8, 8, 8]);
  });

  it('57,5 × 12·12·11·10 (total 45) → 60 × 8·8·8·8, whatever the feeling', () => {
    for (const feeling of ['easy', 'ok', 'hard', null] as const) {
      const t = next(log(57.5, [12, 12, 11, 10], feeling));
      expect(weights(t)).toEqual([60, 60, 60, 60]);
      expect(reps(t)).toEqual([8, 8, 8, 8]);
    }
  });

  it('done 9·9·8·7 (total 33, ≥ 32) "Facile" → step up', () => {
    expect(judge(log(50, [9, 9, 8, 7], 'easy'), null, 8, 12)).toBe('up');
    expect(weights(next(log(50, [9, 9, 8, 7], 'easy')))).toEqual([52.5, 52.5, 52.5, 52.5]);
  });

  it('done 7·7·6·6 (total 26) twice in a row, same pre-fatigue → every weight one step down, targets × 8', () => {
    const previous = log(50, [7, 7, 6, 6], 'ok', { preFatigue: 2 });
    const last = log(50, [7, 7, 6, 6], 'ok', { preFatigue: 2, targets: [8, 8, 8, 8] });
    const t = next(last, { previous });
    expect(weights(t)).toEqual([47.5, 47.5, 47.5, 47.5]);
    expect(reps(t)).toEqual([8, 8, 8, 8]);
  });

  it('…the second time with more pre-fatigue → no drop (weights unchanged, target retried)', () => {
    const previous = log(50, [7, 7, 6, 6], 'ok', { preFatigue: 0 });
    const last = log(50, [7, 7, 6, 6], 'ok', { preFatigue: 3, targets: [8, 8, 8, 8] });
    expect(judge(last, previous, 8, 12)).toBe('retry');
    const t = next(last, { previous });
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([8, 8, 8, 8]);
  });

  it('under the range the first time: same weights, last time’s target (never lowered to what was done)', () => {
    const t = next(log(50, [7, 7, 6, 6], 'ok', { targets: [9, 9, 9, 8] }));
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([9, 9, 9, 8]);
  });

  it('more pre-fatigue today than last time: target reps = last reps (no +1)', () => {
    expect(reps(next(log(50, [10, 10, 10, 8]), { todayPreFatigue: 3 }))).toEqual([10, 10, 10, 8]);
  });

  it('more pre-fatigue and a result as good or better counts normally (step up)', () => {
    expect(judge(log(50, [12, 12, 11, 10], 'ok', { preFatigue: 4 }), log(50, [7, 7, 6, 6]), 8, 12)).toBe('up');
  });

  it('drop set 60×12 · 57,5×12 · 55×12 → 62,5 · 60 · 57,5 (the shape is kept)', () => {
    const t = next(log([60, 57.5, 55], [12, 12, 12]), { setCount: 3, repMin: 8, repMax: 12 });
    expect(weights(t)).toEqual([62.5, 60, 57.5]);
    expect(reps(t)).toEqual([8, 8, 8]);
  });

  it('stopped early: retried, never a step up (2 sets of 12 out of 4)', () => {
    const last = log(50, [12, 12], 'easy', { targets: [10, 10], complete: false });
    expect(judge(last, null, 8, 12)).toBe('retry');
    const t = next(last);
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([10, 10, 10, 10]);
  });

  it('stopped early under the range: no step down, and it never counts as one of the two in a row', () => {
    const early = log(50, [6, 5], 'ok', { targets: [8, 8], complete: false });
    const bad = log(50, [7, 7, 6, 6], 'ok', { targets: [8, 8, 8, 8] });
    expect(judge(early, bad, 8, 12)).toBe('retry');
    expect(judge(bad, early, 8, 12)).toBe('retry');
  });

  describe('superset context (4 × 10–12 at 25 kg)', () => {
    const range = { repMin: 10, repMax: 12 };
    const solo = log(25, [11, 10, 10, 9]);
    const targets = [11, 10, 10, 9];
    const inSuperset = (done: number[]) => log(25, done, 'ok', { targets, inSuperset: true });

    it('done solo last time 25 × 11·10·10·9, in a superset today: targets 25 × 11·10·10·9 (no +1)', () => {
      const t = next(solo, { ...range, todayInSuperset: true });
      expect(weights(t)).toEqual([25, 25, 25, 25]);
      expect(reps(t)).toEqual(targets);
      // Solo again: the usual +1.
      expect(reps(next(solo, range))).toEqual([12, 11, 11, 10]);
    });

    it('…done 10·9·9·8 in the superset: the weight stays 25 kg, the targets are retried', () => {
      const worse = inSuperset([10, 9, 9, 8]);
      expect(judge(worse, solo, 10, 12)).toBe('retry');
      const t = next(worse, { ...range, previous: solo, todayInSuperset: true });
      expect(weights(t)).toEqual([25, 25, 25, 25]);
      expect(reps(t)).toEqual(targets);
    });

    it('…and that session does not count toward the two-in-a-row drop', () => {
      const first = inSuperset([10, 9, 9, 8]);
      const second = inSuperset([10, 9, 9, 8]);
      // Under the range twice in a row, but the first one was the first time in a superset.
      expect(judge(second, first, 10, 12, solo)).toBe('retry');
      // A third one in a row: now two sessions count.
      expect(judge(inSuperset([10, 9, 9, 8]), second, 10, 12, first)).toBe('down');
    });

    it('under the range solo, then in a superset: not a failure either', () => {
      const badSolo = log(25, [9, 9, 9, 8], 'ok', { targets });
      expect(judge(inSuperset([9, 9, 8, 8]), badSolo, 10, 12)).toBe('retry');
      // Both solo: the usual drop.
      expect(judge(log(25, [9, 9, 8, 8], 'ok', { targets }), badSolo, 10, 12)).toBe('down');
    });

    it('a success in a superset counts normally', () => {
      expect(judge(inSuperset([12, 11, 11, 11]), solo, 10, 12)).toBe('up');
      expect(reps(next(inSuperset([11, 10, 10, 10]), { ...range, previous: solo, todayInSuperset: true }))).toEqual([
        12, 11, 11, 11,
      ]);
    });

    it('from a superset back to solo: no special case', () => {
      const last = inSuperset([11, 10, 10, 9]);
      expect(reps(next(last, range))).toEqual([12, 11, 11, 10]);
      const bad = inSuperset([9, 9, 8, 8]);
      expect(judge(log(25, [9, 9, 8, 8], 'ok', { targets }), bad, 10, 12, bad)).toBe('down');
    });
  });

  describe('the scheme of the exercise changed', () => {
    it('more sets: the added ones copy the last set’s target', () => {
      const last = log(50, [10, 10, 10, 8]);
      const t = next(last, { setCount: 5 });
      expect(weights(t)).toEqual([50, 50, 50, 50, 50]);
      expect(reps(t)).toEqual([11, 11, 11, 9, 9]);
      // Drop set: the added set takes the last (lightest) weight.
      expect(weights(next(log([60, 57.5, 55], [10, 10, 10]), { setCount: 4 }))).toEqual([60, 57.5, 55, 55]);
    });

    it('4 × 8–12 → 3 × 8–12: the next session has 3 sets, the removed one is dropped', () => {
      const t = next(log(50, [10, 10, 10, 8]), { setCount: 3 });
      expect(weights(t)).toEqual([50, 50, 50]);
      expect(reps(t)).toEqual([11, 11, 11]);
      // The last session is still judged on its own 4 sets (44 → up).
      const up = next(log(50, [12, 12, 12, 8]), { setCount: 3 });
      expect(weights(up)).toEqual([52.5, 52.5, 52.5]);
      expect(reps(up)).toEqual([8, 8, 8]);
    });

    it('range changed to 6–10 with 3 sets: Up threshold 27 reps, Down threshold 18, weights unchanged', () => {
      const scheme = { setCount: 3, repMin: 6, repMax: 10 };
      expect(judge(log(50, [9, 9, 9]), null, 6, 10)).toBe('up');
      expect(judge(log(50, [9, 9, 8]), null, 6, 10)).toBe('progress');
      expect(judge(log(50, [6, 6, 6]), log(50, [6, 6, 5]), 6, 10)).toBe('progress');
      expect(judge(log(50, [6, 6, 5]), log(50, [6, 6, 5]), 6, 10)).toBe('down');
      // Same weights, +1 capped at the new maximum; a session done in 8–12 is judged with the new range.
      const t = next(log(50, [9, 8, 8]), scheme);
      expect(weights(t)).toEqual([50, 50, 50]);
      expect(reps(t)).toEqual([10, 9, 9]);
      const stepped = next(log(50, [11, 11, 10]), scheme);
      expect(weights(stepped)).toEqual([52.5, 52.5, 52.5]);
      expect(reps(stepped)).toEqual([6, 6, 6]);
    });
  });
});
