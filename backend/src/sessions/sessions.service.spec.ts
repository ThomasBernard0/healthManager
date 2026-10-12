import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ProgressionService } from './progression.service.js';
import { partnerOf, SessionsService } from './sessions.service.js';

/** Past the checks, the fake stops with this error (the rest is covered against Postgres). */
const PASSED = new Error('passed the checks');

function service(done: boolean[], equipment = 'barbell', update: (args: unknown) => Promise<never> = () => Promise.reject(PASSED)) {
  const entry = {
    id: 'e1',
    sessionId: 's1',
    preFatigue: 0,
    session: { finishedAt: null },
    exercise: { equipment },
    sets: done.map((d, index) => ({
      id: `set${index}`,
      index,
      done: d,
      doneAt: d ? new Date(1000 + index) : null,
      targetWeight: null,
      targetReps: null,
    })),
  };
  const prisma = {
    sessionExercise: { findFirst: () => Promise.resolve(entry) },
    sessionSet: { update },
  };
  return new SessionsService(prisma as unknown as PrismaService, {} as ProgressionService);
}

describe('SessionsService.saveSet: sets in order', () => {
  it('rejects validating a set while an earlier one is not done', async () => {
    await expect(service([true, false, false]).saveSet('s1', 'e1', 2, { weight: 50, reps: 10, done: true })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('validates the next set', async () => {
    await expect(service([true, false, false]).saveSet('s1', 'e1', 1, { weight: 50, reps: 10, done: true })).rejects.toBe(
      PASSED,
    );
  });

  it('reopens any done set, whatever its position', async () => {
    await expect(service([true, true, false]).saveSet('s1', 'e1', 0, { weight: 50, reps: 10, done: false })).rejects.toBe(
      PASSED,
    );
  });
});

describe('SessionsService.saveSet: assistance (negative weight)', () => {
  it('accepts −10 for Tractions (bodyweight)', async () => {
    await expect(service([false], 'bodyweight').saveSet('s1', 'e1', 0, { weight: -10, reps: 9, done: true })).rejects.toBe(
      PASSED,
    );
  });

  it('rejects −10 on a barbell exercise, validated or just typed', async () => {
    for (const done of [true, false]) {
      await expect(service([false]).saveSet('s1', 'e1', 0, { weight: -10, reps: 9, done })).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it('Lest ↔ Aide: a done set is saved again with the other sign, whatever the sets before it, and keeps its time', async () => {
    const update = vi.fn().mockRejectedValue(PASSED);
    // Set 1 was reopened: set 2 is done after a set that is not.
    await expect(
      service([false, true], 'bodyweight', update).saveSet('s1', 'e1', 1, { weight: -10, reps: 9, done: true }),
    ).rejects.toBe(PASSED);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'set1' },
      data: { weight: -10, reps: 9, done: true, doneAt: new Date(1001) },
    });
  });
});

describe('partnerOf', () => {
  const entries = [
    { id: 'a', supersetGroup: 'g' },
    { id: 'b', supersetGroup: 'g' },
    { id: 'c', supersetGroup: null },
    { id: 'd', supersetGroup: null },
  ];

  it('finds the other exercise of the superset', () => {
    expect(partnerOf(entries[0], entries)).toBe(entries[1]);
    expect(partnerOf(entries[1], entries)).toBe(entries[0]);
  });

  it('has no partner for a solo exercise', () => {
    expect(partnerOf(entries[2], entries)).toBeNull();
  });
});

describe('SessionsService.finish: superset partner skipped', () => {
  it('makes solo the exercise whose partner was dropped, keeps a full pair', async () => {
    const updateMany = vi.fn();
    const prisma = {
      session: { findUnique: () => Promise.resolve({ id: 's1', finishedAt: null }), update: vi.fn() },
      sessionExercise: {
        deleteMany: () => Promise.resolve(),
        findMany: () =>
          Promise.resolve([
            { id: 'a', supersetGroup: 'g' },
            { id: 'c', supersetGroup: 'h' },
            { id: 'd', supersetGroup: 'h' },
          ]),
        updateMany,
      },
      $transaction: (ops: unknown[]) => Promise.all(ops),
    };
    await new SessionsService(prisma as unknown as PrismaService, {} as ProgressionService).finish('s1');
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a'] } }, data: { supersetGroup: null } });
    expect(prisma.session.update).toHaveBeenCalled();
  });
});

describe('SessionsService.start: the scheme of each exercise', () => {
  it('creates the sets of the exercise and snapshots its rep range', async () => {
    const workout = {
      id: 'w1',
      name: 'Pull',
      program: { active: true },
      items: [
        { exerciseId: 'x1', position: 0, supersetGroup: null, exercise: { sets: 3, repMin: 6, repMax: 10 } },
        { exerciseId: 'x2', position: 1, supersetGroup: null, exercise: { sets: 4, repMin: 8, repMax: 12 } },
      ],
    };
    const create = vi.fn().mockRejectedValue(PASSED);
    const prisma = {
      session: { findFirst: () => Promise.resolve(null), create },
      workout: { findUnique: () => Promise.resolve(workout) },
    };
    await expect(
      new SessionsService(prisma as unknown as PrismaService, {} as ProgressionService).start('w1'),
    ).rejects.toBe(PASSED);
    expect(create.mock.calls[0][0].data.exercises.create).toEqual([
      { exerciseId: 'x1', position: 0, repMin: 6, repMax: 10, supersetGroup: null, sets: { create: [{ index: 0 }, { index: 1 }, { index: 2 }] } },
      {
        exerciseId: 'x2',
        position: 1,
        repMin: 8,
        repMax: 12,
        supersetGroup: null,
        sets: { create: [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }] },
      },
    ]);
  });
});

describe('SessionsService.start: active program only', () => {
  function starting(active: boolean) {
    const workout = {
      id: 'w1',
      name: 'Push A',
      items: [{ exerciseId: 'x1', exercise: { sets: 4, repMin: 8, repMax: 12 } }],
      program: { active },
    };
    const prisma = {
      session: { findFirst: () => Promise.resolve(null), create: () => Promise.reject(PASSED) },
      workout: { findUnique: () => Promise.resolve(workout) },
    };
    return new SessionsService(prisma as unknown as PrismaService, {} as ProgressionService);
  }

  it('rejects a workout of an inactive program', async () => {
    await expect(starting(false).start('w1')).rejects.toThrow(BadRequestException);
  });

  it('starts a workout of the active program', async () => {
    await expect(starting(true).start('w1')).rejects.toBe(PASSED);
  });
});
