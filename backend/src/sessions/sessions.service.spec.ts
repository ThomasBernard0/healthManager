import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ProgressionService } from './progression.service.js';
import { SessionsService } from './sessions.service.js';

/** Past the order check, the fake stops with this error (the rest is covered against Postgres). */
const PASSED = new Error('passed the order check');

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
