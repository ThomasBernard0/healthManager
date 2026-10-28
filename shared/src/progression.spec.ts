import {
  ASSIST_STEP,
  DEFAULT_STEP,
  harmonize,
  judge,
  nextTargets,
  preFatigue,
  sessionPreFatigue,
  stepDown,
  stepUp,
  targetsFromHistory,
  upThreshold,
  type ExerciseLog,
  type NextTargetsInput,
  type SessionEntry,
} from './progression.js';
import { DIPS_THEN_BENCH } from './testing/index.js';

/** A past session: weight (one for all sets, or one per set), reps done, Facile tapped, targets. */
function log(
  weight: number | number[],
  reps: number[],
  easy = false,
  options: { targets?: number[]; preFatigue?: number; complete?: boolean } = {},
): ExerciseLog {
  return {
    sets: reps.map((r, i) => {
      const w = Array.isArray(weight) ? weight[i] : weight;
      return { weight: w, reps: r, targetWeight: options.targets ? w : null, targetReps: options.targets?.[i] ?? null };
    }),
    easy,
    preFatigue: options.preFatigue ?? 0,
    complete: options.complete ?? true,
  };
}

/** 4 × 7–10 on a cable (2.5 kg step), nothing else known. */
const next = (last: ExerciseLog | null, extra: Partial<NextTargetsInput> = {}) =>
  nextTargets({
    last,
    previous: null,
    setCount: 4,
    repMin: 7,
    repMax: 10,
    known: last ? last.sets.map((s) => s.weight) : [],
    step: DEFAULT_STEP.cable,
    ...extra,
  });

const weights = (t: ReturnType<typeof nextTargets>) => t!.map((x) => x.weight);
const reps = (t: ReturnType<typeof nextTargets>) => t!.map((x) => x.reps);

describe('stepUp / stepDown (available weights, learned)', () => {
  it('default step by equipment', () => {
    expect(DEFAULT_STEP).toEqual({ barbell: 5, dumbbell: 2, machine: 4.5, cable: 2.5, bodyweight: 2.5 });
  });

  it('no known weight above: current + step', () => {
    expect(stepUp(8, [8], DEFAULT_STEP.machine)).toBe(12.5);
    expect(stepUp(10, [10], DEFAULT_STEP.dumbbell)).toBe(12);
    expect(stepUp(60, [60], DEFAULT_STEP.barbell)).toBe(65);
  });

  it('known {8, 30}: stepping up from 8 (machine) gives 12,5, not 30 (too far)', () => {
    expect(stepUp(8, [8, 30], DEFAULT_STEP.machine)).toBe(12.5);
  });

  it('dumbbells 10 kg "Facile", user logged 12,5: a step up from 10 gives 12,5', () => {
    expect(stepUp(10, [10, 12.5], DEFAULT_STEP.dumbbell)).toBe(12.5);
  });

  it('a typo fixed in a past set is no longer a known weight', () => {
    // 600 typed instead of 60, then fixed: known weights are read from the sets again.
    expect(stepUp(60, [57.5, 60], 2.5)).toBe(62.5);
  });

  it('stepDown mirrors it and never goes below 0', () => {
    expect(stepDown(12.5, [8, 12.5], DEFAULT_STEP.machine)).toBe(8);
    expect(stepDown(12.5, [10, 12.5], DEFAULT_STEP.dumbbell)).toBe(10);
    expect(stepDown(30, [8, 30], DEFAULT_STEP.machine)).toBe(25.5);
    expect(stepDown(2, [], DEFAULT_STEP.machine)).toBe(0);
  });
});

describe('assistance: negative weights on bodyweight exercises', () => {
  const step = DEFAULT_STEP.bodyweight;
  /** Tractions, 4 × 7–10. */
  const pullUps = (last: ExerciseLog, extra: Partial<NextTargetsInput> = {}) => next(last, { step, ...extra });

  it('steps by 4,5 while the weight is negative', () => {
    expect(ASSIST_STEP).toBe(4.5);
    expect(stepUp(-9, [-9], step)).toBe(-4.5);
    expect(stepDown(-9, [-9], step)).toBe(-13.5);
  });

  it('stepUp from help never goes above 0', () => {
    expect(stepUp(-2, [], step)).toBe(0);
    expect(stepUp(-4.5, [-4.5], step)).toBe(0);
    // A known added load within reach is not a way to skip bodyweight.
    expect(stepUp(-2, [-2, 2.5], step)).toBe(0);
  });

  it('from 0 or more: the bodyweight step, and stepDown never proposes help', () => {
    expect(stepUp(0, [0], step)).toBe(2.5);
    expect(stepDown(0, [0], step)).toBe(0);
    expect(stepDown(0, [-9, 0], step)).toBe(0);
    expect(stepDown(2.5, [2.5], step)).toBe(0);
  });

  it('known weights work on the signed values', () => {
    expect(stepUp(-9, [-9, -4.5], step)).toBe(-4.5);
    expect(stepUp(-9, [-9, -5], step)).toBe(-5);
    expect(stepDown(-9, [-12, -9], step)).toBe(-12);
    // Too far (more than 2 steps): the default step.
    expect(stepUp(-20, [-20, -9], step)).toBe(-15.5);
  });

  it('−9 × 10·10·10·8 (total 38) → −4,5 × 7·7·7·7', () => {
    const t = pullUps(log(-9, [10, 10, 10, 8]));
    expect(weights(t)).toEqual([-4.5, -4.5, -4.5, -4.5]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
  });

  it('−4,5 × 10·10·10·9 → 0 × 7·7·7·7 (bodyweight)', () => {
    const t = pullUps(log(-4.5, [10, 10, 10, 9]));
    expect(weights(t)).toEqual([0, 0, 0, 0]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
  });

  it('0 × 10·10·9·9 → 2,5 × 7·7·7·7', () => {
    const t = pullUps(log(0, [10, 10, 9, 9]));
    expect(weights(t)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
  });

  it('Aide 20 × 9·9·8·8 (total 34) → Aide 20 × 10·10·9·9', () => {
    const t = pullUps(log(-20, [9, 9, 8, 8]));
    expect(weights(t)).toEqual([-20, -20, -20, -20]);
    expect(reps(t)).toEqual([10, 10, 9, 9]);
  });

  it('0 × 7·7·6·6 twice → stays 0 (no help proposed); under the range twice with help → more help', () => {
    const twice = (weight: number) =>
      pullUps(log(weight, [7, 7, 6, 6], false, { targets: [7, 7, 7, 7] }), { previous: log(weight, [7, 7, 6, 6]) });
    expect(weights(twice(0))).toEqual([0, 0, 0, 0]);
    expect(reps(twice(0))).toEqual([7, 7, 7, 7]);
    expect(weights(twice(-9))).toEqual([-13.5, -13.5, -13.5, -13.5]);
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

describe('judge and nextTargets (double progression, 4 × 7–10)', () => {
  it('Up threshold: N × repMax − 2 (4 × 7–10 → 38, 3 × 9–12 → 34)', () => {
    expect(upThreshold(4, 10)).toBe(38);
    expect(upThreshold(3, 12)).toBe(34);
    expect(judge(log(50, [10, 10, 10, 8]), null, 7, 10)).toBe('up');
    expect(judge(log(50, [10, 10, 9, 8]), null, 7, 10)).toBe('progress');
  });

  it('first time: no target', () => {
    expect(next(null)).toBeNull();
  });

  it('50 kg, done 10·10·10·8 (total 38) → one step up, targets × 7·7·7·7', () => {
    const t = next(log(50, [10, 10, 10, 8]));
    expect(weights(t)).toEqual([52.5, 52.5, 52.5, 52.5]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
  });

  it('barbell 60 kg, done 10·10·10·8, no known weight above → 65 × 7·7·7·7', () => {
    const t = next(log(60, [10, 10, 10, 8]), { step: DEFAULT_STEP.barbell });
    expect(weights(t)).toEqual([65, 65, 65, 65]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
  });

  it('done 10·10·9·8 (total 37) → 50 × 10·10·10·9; done as targeted (39) → step up the time after', () => {
    const t = next(log(50, [10, 10, 9, 8]));
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([10, 10, 10, 9]);
    expect(judge(log(50, [10, 10, 10, 9], false, { targets: [10, 10, 10, 9] }), null, 7, 10)).toBe('up');
  });

  it('done 10·10·10·6 (total 36) → 50 × 10·10·10·7; never counts toward a drop', () => {
    const last = log(50, [10, 10, 10, 6]);
    expect(reps(next(last))).toEqual([10, 10, 10, 7]);
    expect(judge(last, log(50, [7, 6, 6, 6]), 7, 10)).toBe('progress');
  });

  it('target 50 × 8·8·8·8, done 8·8·8·7 → 50 × 9·9·9·8', () => {
    const t = next(log(50, [8, 8, 8, 7], false, { targets: [8, 8, 8, 8] }));
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([9, 9, 9, 8]);
  });

  it('reps rebalance: 8·8·8·7 → 9·9·9·8 → 10·10·10·9 (total 39) → next weight', () => {
    const second = next(log(50, [8, 8, 8, 7]))!;
    expect(reps(second)).toEqual([9, 9, 9, 8]);
    const third = next(log(50, reps(second), false, { targets: reps(second) }))!;
    expect(reps(third)).toEqual([10, 10, 10, 9]);
    const fourth = next(log(50, reps(third), false, { targets: reps(third) }));
    expect(weights(fourth)).toEqual([52.5, 52.5, 52.5, 52.5]);
    expect(reps(fourth)).toEqual([7, 7, 7, 7]);
  });

  it('57,5 × 10·10·9·9 (total 38) → 60 × 7·7·7·7, with or without Facile', () => {
    for (const easy of [true, false]) {
      const t = next(log(57.5, [10, 10, 9, 9], easy));
      expect(weights(t)).toEqual([60, 60, 60, 60]);
      expect(reps(t)).toEqual([7, 7, 7, 7]);
    }
  });

  it('done 8·7·7·6 (total 28, ≥ 28) "Facile" → step up', () => {
    expect(judge(log(50, [8, 7, 7, 6], true), null, 7, 10)).toBe('up');
    expect(weights(next(log(50, [8, 7, 7, 6], true)))).toEqual([52.5, 52.5, 52.5, 52.5]);
    // Without Facile: the usual +1.
    expect(judge(log(50, [8, 7, 7, 6]), null, 7, 10)).toBe('progress');
  });

  it('"Facile" under the range (total 25 < 28): no step up, targets retried', () => {
    expect(judge(log(50, [7, 6, 6, 6], true, { targets: [7, 7, 7, 7] }), null, 7, 10)).toBe('retry');
  });

  it('done 7·6·6·6 (total 25) twice in a row, same pre-fatigue → every weight one step down, targets × 7', () => {
    const previous = log(50, [7, 6, 6, 6], false, { preFatigue: 2 });
    const last = log(50, [7, 6, 6, 6], false, { preFatigue: 2, targets: [8, 8, 8, 8] });
    const t = next(last, { previous });
    expect(weights(t)).toEqual([47.5, 47.5, 47.5, 47.5]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
  });

  it('…the second time with more pre-fatigue → no drop (weights unchanged, target retried)', () => {
    const previous = log(50, [7, 6, 6, 6], false, { preFatigue: 0 });
    const last = log(50, [7, 6, 6, 6], false, { preFatigue: 3, targets: [8, 8, 8, 8] });
    expect(judge(last, previous, 7, 10)).toBe('retry');
    const t = next(last, { previous });
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([8, 8, 8, 8]);
  });

  it('done 7·7·6·6 (total 26, < 28) the first time: same weights, last time’s target (never lowered to what was done)', () => {
    const t = next(log(50, [7, 7, 6, 6], false, { targets: [9, 9, 9, 8] }));
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([9, 9, 9, 8]);
  });

  it('target 8·8·8·8 done with more pre-fatigue than last time → 9·9·9·9: pre-fatigue never blocks the +1', () => {
    const previous = log(50, [8, 8, 8, 7], false, { preFatigue: 0 });
    const last = log(50, [8, 8, 8, 8], false, { preFatigue: 3, targets: [8, 8, 8, 8] });
    expect(reps(next(last, { previous }))).toEqual([9, 9, 9, 9]);
  });

  it('more pre-fatigue and a result as good or better counts normally (step up)', () => {
    expect(judge(log(50, [10, 10, 9, 9], false, { preFatigue: 4 }), log(50, [7, 7, 6, 6]), 7, 10)).toBe('up');
  });

  it('every target is clamped to [repMin, repMax]: a retried 11 on 7–10 becomes 10', () => {
    const t = next(log(50, [7, 6, 6, 6], false, { targets: [11, 11, 10, 10] }));
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([10, 10, 10, 10]);
    // …and a +1 under a raised minimum comes up to it (3 × 9–12, done 10·10·7 = 27, not under the range).
    expect(reps(next(log(50, [10, 10, 7]), { setCount: 3, repMin: 9, repMax: 12 }))).toEqual([11, 11, 9]);
  });

  it('drop set 60×10 · 57,5×10 · 55×10 (3 × 7–10, total 30 ≥ 28) → 62,5 · 60 · 57,5, targets × 7', () => {
    const t = next(log([60, 57.5, 55], [10, 10, 10]), { setCount: 3 });
    expect(weights(t)).toEqual([62.5, 60, 57.5]);
    expect(reps(t)).toEqual([7, 7, 7]);
  });

  it('stopped early: retried, never a step up (2 sets of 10 out of 4)', () => {
    const last = log(50, [10, 10], true, { targets: [9, 9], complete: false });
    expect(judge(last, null, 7, 10)).toBe('retry');
    const t = next(last);
    expect(weights(t)).toEqual([50, 50, 50, 50]);
    expect(reps(t)).toEqual([9, 9, 9, 9]);
  });

  it('stopped early under the range: no step down, and it never counts as one of the two in a row', () => {
    const early = log(50, [6, 5], false, { targets: [7, 7], complete: false });
    const bad = log(50, [7, 6, 6, 6], false, { targets: [7, 7, 7, 7] });
    expect(judge(early, bad, 7, 10)).toBe('retry');
    expect(judge(bad, early, 7, 10)).toBe('retry');
  });

  it('3 × 9–12: done 12·11·11 (total 34 ≥ 34) → Up × 9·9·9; done 12·11·10 (33) → 12·12·11', () => {
    const scheme = { setCount: 3, repMin: 9, repMax: 12 };
    const up = next(log(20, [12, 11, 11]), scheme);
    expect(weights(up)).toEqual([22.5, 22.5, 22.5]);
    expect(reps(up)).toEqual([9, 9, 9]);
    const t = next(log(20, [12, 11, 10]), scheme);
    expect(weights(t)).toEqual([20, 20, 20]);
    expect(reps(t)).toEqual([12, 12, 11]);
  });

  it('no superset special case: done solo at 25 × 9·9·8·8, the next targets are 25 × 10·10·9·9 wherever it is done', () => {
    const t = next(log(25, [9, 9, 8, 8]));
    expect(weights(t)).toEqual([25, 25, 25, 25]);
    expect(reps(t)).toEqual([10, 10, 9, 9]);
    // Under the range twice in a row (the second time in a superset): the usual drop.
    expect(judge(log(25, [7, 6, 6, 6]), log(25, [7, 6, 6, 6]), 7, 10)).toBe('down');
  });

  describe('the scheme of the exercise changed', () => {
    it('more sets: the added ones copy the last set’s target', () => {
      const t = next(log(50, [8, 8, 8, 7]), { setCount: 5 });
      expect(weights(t)).toEqual([50, 50, 50, 50, 50]);
      expect(reps(t)).toEqual([9, 9, 9, 8, 8]);
      // Drop set: the added set takes the last (lightest) weight.
      expect(weights(next(log([60, 57.5, 55], [8, 8, 8]), { setCount: 4 }))).toEqual([60, 57.5, 55, 55]);
    });

    it('4 × 7–10 → 3 × 7–10: the next session has 3 sets, the removed one is dropped', () => {
      const t = next(log(50, [8, 8, 8, 7]), { setCount: 3 });
      expect(weights(t)).toEqual([50, 50, 50]);
      expect(reps(t)).toEqual([9, 9, 9]);
      // The last session is still judged on its own 4 sets (38 → up).
      const up = next(log(50, [10, 10, 10, 8]), { setCount: 3 });
      expect(weights(up)).toEqual([52.5, 52.5, 52.5]);
      expect(reps(up)).toEqual([7, 7, 7]);
    });

    it('range changed to 6–10 with 3 sets: Up threshold 28 reps, Down threshold 18, weights unchanged', () => {
      const scheme = { setCount: 3, repMin: 6, repMax: 10 };
      expect(judge(log(50, [10, 9, 9]), null, 6, 10)).toBe('up');
      expect(judge(log(50, [9, 9, 9]), null, 6, 10)).toBe('progress');
      expect(judge(log(50, [6, 6, 6]), log(50, [6, 6, 5]), 6, 10)).toBe('progress');
      expect(judge(log(50, [6, 6, 5]), log(50, [6, 6, 5]), 6, 10)).toBe('down');
      const t = next(log(50, [9, 8, 8]), scheme);
      expect(weights(t)).toEqual([50, 50, 50]);
      expect(reps(t)).toEqual([10, 9, 9]);
      const stepped = next(log(50, [10, 10, 8]), scheme);
      expect(weights(stepped)).toEqual([52.5, 52.5, 52.5]);
      expect(reps(stepped)).toEqual([6, 6, 6]);
    });

    it('range migration 8–12 → 7–10: 60 × 12·12·11·10 (45 ≥ 38) → 65 × 7·7·7·7; 60 × 8·8·8·8 → 60 × 9·9·9·9; a retried 11 → 10', () => {
      const barbell = { step: DEFAULT_STEP.barbell };
      const up = next(log(60, [12, 12, 11, 10], false, { targets: [12, 12, 11, 10] }), barbell);
      expect(weights(up)).toEqual([65, 65, 65, 65]);
      expect(reps(up)).toEqual([7, 7, 7, 7]);
      const plusOne = next(log(60, [8, 8, 8, 8], false, { targets: [8, 8, 8, 8] }), barbell);
      expect(weights(plusOne)).toEqual([60, 60, 60, 60]);
      expect(reps(plusOne)).toEqual([9, 9, 9, 9]);
      const retried = next(log(60, [7, 6, 6, 6], false, { targets: [11, 11, 11, 11] }), barbell);
      expect(weights(retried)).toEqual([60, 60, 60, 60]);
      expect(reps(retried)).toEqual([10, 10, 10, 10]);
    });

    it('range migration 10–15 → 9–12 (4 sets): 20 × 15·15·14·13 (57 ≥ 46) → 22,5 × 9·9·9·9', () => {
      const t = next(log(20, [15, 15, 14, 13], false, { targets: [15, 15, 14, 13] }), { repMin: 9, repMax: 12 });
      expect(weights(t)).toEqual([22.5, 22.5, 22.5, 22.5]);
      expect(reps(t)).toEqual([9, 9, 9, 9]);
    });
  });
});

describe('harmonize a lone off-weight set (step 1, 4 × 7–10)', () => {
  it('sets aside the one set at another weight; drop sets and a single weight are left as they are', () => {
    const lone = harmonize(log([60, 60, 60, 50], [10, 10, 10, 12]).sets);
    expect(lone.loneIndex).toBe(3);
    expect(lone.commonWeight).toBe(60);
    expect(lone.keptSets.map((s) => s.reps)).toEqual([10, 10, 10]);
    expect(harmonize(log(60, [10, 10, 10, 10]).sets)).toMatchObject({ commonWeight: 60, loneIndex: null });
    expect(harmonize(log([60, 57.5, 55], [10, 10, 10]).sets)).toMatchObject({ commonWeight: null, loneIndex: null });
    expect(harmonize(log([60, 60, 50, 50], [10, 10, 10, 10]).sets)).toMatchObject({ commonWeight: null, loneIndex: null });
    expect(harmonize(log([60, 55], [10, 10]).sets)).toMatchObject({ commonWeight: null, loneIndex: null });
  });

  it('Tractions: aide 32 × 5, then aide 41 × 10 · 10 · 10 → judged on 41 × 10 · 10 · 10 (30 ≥ 28) → Up → aide 32 × 7 · 7 · 7 · 7', () => {
    const last = log([-32, -41, -41, -41], [5, 10, 10, 10]);
    expect(judge(last, null, 7, 10)).toBe('up');
    // The lone weight stays known: −32 is exactly 2 assist steps above −41, so stepUp takes it.
    const t = next(last, { step: DEFAULT_STEP.bodyweight });
    expect(weights(t)).toEqual([-32, -32, -32, -32]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
    // With −32 not known: one assist step.
    expect(weights(next(last, { step: DEFAULT_STEP.bodyweight, known: [-41] }))).toEqual([-36.5, -36.5, -36.5, -36.5]);
  });

  it('60 × 9 · 9 · 8 then a last set at 50 × 10 → harmonized (26 < 28, ≥ 21) → 60 × 9 · 9 · 8 · 8', () => {
    const last = log([60, 60, 60, 50], [9, 9, 8, 10]);
    expect(judge(last, null, 7, 10)).toBe('progress');
    const t = next(last);
    expect(weights(t)).toEqual([60, 60, 60, 60]);
    expect(reps(t)).toEqual([9, 9, 8, 8]);
  });

  it('barbell 60 × 8 then 50 × 10 · 10 · 10 → judged on the 50 kg sets (30 ≥ 28) → Up → 55 × 7 · 7 · 7 · 7', () => {
    const last = log([60, 50, 50, 50], [8, 10, 10, 10]);
    expect(judge(last, null, 7, 10)).toBe('up');
    const t = next(last, { step: DEFAULT_STEP.barbell, known: [50, 55, 60] });
    expect(weights(t)).toEqual([55, 55, 55, 55]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
    // The lone weight stays known: with only 50 and 60 known, stepUp from 50 takes 60 (2 steps away).
    expect(weights(next(last, { step: DEFAULT_STEP.barbell, known: [50, 60] }))).toEqual([60, 60, 60, 60]);
  });

  it('60 × 9 · 8 · 8 then 70 × 4 (25 < 28) → 60 × 9 · 8 · 8 · 8 (the harmonized set gets the lowest)', () => {
    const t = next(log([60, 60, 60, 70], [9, 8, 8, 4]));
    expect(weights(t)).toEqual([60, 60, 60, 60]);
    expect(reps(t)).toEqual([9, 8, 8, 8]);
  });

  it('the lone set first or in the middle keeps its place', () => {
    const t = next(log([60, 62.5, 60, 60], [8, 7, 9, 9]));
    expect(weights(t)).toEqual([60, 60, 60, 60]);
    expect(reps(t)).toEqual([8, 8, 9, 9]);
  });

  it('drop sets 60 / 57,5 / 55 or 60 · 60 · 50 · 50 → not harmonized, the shape is kept', () => {
    const three = next(log([60, 57.5, 55], [8, 8, 8]), { setCount: 3 });
    expect(weights(three)).toEqual([60, 57.5, 55]);
    expect(reps(three)).toEqual([9, 9, 9]);
    const split = next(log([60, 60, 50, 50], [8, 8, 8, 8]));
    expect(weights(split)).toEqual([60, 60, 50, 50]);
    expect(reps(split)).toEqual([9, 9, 9, 9]);
  });

  it('a lone off-weight set on a 3-set exercise → every set at the common weight', () => {
    const t = next(log([60, 60, 55], [8, 8, 10]), { setCount: 3 });
    expect(weights(t)).toEqual([60, 60, 60]);
    expect(reps(t)).toEqual([8, 8, 8]);
  });

  it('2 sets at 2 weights: a drop set, not harmonized (+1 each)', () => {
    const t = next(log([60, 55], [8, 8]), { setCount: 2 });
    expect(weights(t)).toEqual([60, 55]);
    expect(reps(t)).toEqual([9, 9]);
  });

  it('retry: every set at the common weight with the common sets’ last targets, the harmonized one the lowest', () => {
    // Kept 6 · 6 · 6 = 18 < 21 (all 4 sets: 30, not under the range).
    const t = next(log([60, 60, 60, 50], [6, 6, 6, 12], false, { targets: [8, 7, 7, 12] }));
    expect(weights(t)).toEqual([60, 60, 60, 60]);
    expect(reps(t)).toEqual([8, 7, 7, 7]);
  });

  it('the two-in-a-row drop counts the kept sets of each session', () => {
    const harmonized = log([60, 60, 60, 50], [6, 6, 6, 12], false, { targets: [7, 7, 7, 7] });
    const t = next(harmonized, { previous: log(60, [6, 6, 6, 6]) });
    expect(weights(t)).toEqual([57.5, 57.5, 57.5, 57.5]);
    expect(reps(t)).toEqual([7, 7, 7, 7]);
    expect(judge(log(60, [6, 6, 6, 6]), harmonized, 7, 10)).toBe('down');
  });

  it('with more pre-fatigue: a worse result is not a failure', () => {
    const last = log([60, 60, 60, 50], [6, 6, 6, 12], false, { targets: [7, 7, 7, 7], preFatigue: 3 });
    expect(judge(last, log(60, [6, 6, 6, 6]), 7, 10)).toBe('retry');
  });

  it('the set count changed: the added sets copy the last target at the common weight', () => {
    const t = next(log([60, 60, 60, 50], [8, 8, 8, 10]), { setCount: 5 });
    expect(weights(t)).toEqual([60, 60, 60, 60, 60]);
    expect(reps(t)).toEqual([8, 8, 8, 8, 8]);
  });
});

describe('sessionPreFatigue (order of the session)', () => {
  const entry = (
    id: string,
    primaryMuscles: SessionEntry['exercise']['primaryMuscles'],
    secondaryMuscles: SessionEntry['exercise']['secondaryMuscles'],
    doneAt: (number | null)[],
  ): SessionEntry => ({
    id,
    firstSetAt: doneAt.find((m) => m !== null) ?? null,
    exercise: { primaryMuscles, secondaryMuscles },
    sets: doneAt.map((m) => ({ done: m !== null, doneAt: m })),
  });
  const dips = entry('dips', ['chest'], ['triceps'], [0, 3, 6, null]);
  const curls = entry('curls', ['biceps'], ['forearms'], [10, 12, 14, 16]);

  it('not started yet: every set validated so far on its primary muscles', () => {
    const bench = entry('bench', ['chest'], ['triceps'], [null, null, null, null]);
    expect(sessionPreFatigue(bench, [dips, curls, bench])).toEqual({ value: 3, muscles: ['chest'] });
  });

  it('started: only the sets validated before its first set count', () => {
    const bench = entry('bench', ['chest'], ['triceps'], [4, 8, null, null]);
    expect(sessionPreFatigue(bench, [dips, curls, bench]).value).toBe(2);
  });
});

describe('targetsFromHistory', () => {
  const { bench } = DIPS_THEN_BENCH;

  it('Développé couché: the +1, done first or after 3 sets of Dips', () => {
    const t = targetsFromHistory(bench.history, {
      setCount: bench.sets,
      repMin: bench.repMin,
      repMax: bench.repMax,
      known: bench.known,
      step: DEFAULT_STEP[bench.equipment],
    });
    expect(t).toEqual(DIPS_THEN_BENCH.benchTargets);
  });

  it('no history: no target', () => {
    expect(targetsFromHistory([], { setCount: 4, repMin: 7, repMax: 10, known: [], step: 5 })).toBeNull();
  });
});
