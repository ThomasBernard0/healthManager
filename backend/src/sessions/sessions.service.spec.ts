import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ProgressionService } from './progression.service.js';
import { partnerOf, SessionsService } from './sessions.service.js';

/** Past the checks, the fake stops with this error (the rest is covered against Postgres). */
const PASSED = new Error('passed the checks');

function service(done: boolean[]) {
  const entry = {
    id: 'e1',
    sessionId: 's1',
    preFatigue: 0,
    session: { finishedAt: null },
    sets: done.map((d, index) => ({ id: `set${index}`, index, done: d, targetWeight: null, targetReps: null })),
  };
  const prisma = {
    sessionExercise: { findFirst: () => Promise.resolve(entry) },
    sessionSet: { update: () => Promise.reject(PASSED) },
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

describe('SessionsService.start: active program only', () => {
  function starting(active: boolean) {
    const workout = { id: 'w1', name: 'Push A', items: [{ exerciseId: 'x1' }], program: { active } };
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
