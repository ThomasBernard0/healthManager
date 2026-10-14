import { BadRequestException } from '@nestjs/common';
import type { FinishExerciseDto } from './dto/save-session.dto.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ProgressionService } from './progression.service.js';
import { checkFinish, partnerOf, SessionsService } from './sessions.service.js';

/** Past the checks, the fake stops with this error (the rest is covered against Postgres). */
const PASSED = new Error('passed the checks');

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

describe('checkFinish (Terminer: the body against the session)', () => {
  const stored = [
    { id: 'pullups', exercise: { equipment: 'bodyweight' }, sets: [{ index: 0 }, { index: 1 }] },
    { id: 'bench', exercise: { equipment: 'barbell' }, sets: [{ index: 0 }, { index: 1 }] },
  ];
  const set = (index: number, weight: number | null, done = true) => ({
    index,
    targetWeight: null,
    targetReps: null,
    weight,
    reps: weight === null ? null : 9,
    done,
    doneAt: done ? '2026-10-14T17:00:00.000Z' : null,
  });
  const sent = (id: string, ...sets: ReturnType<typeof set>[]): FinishExerciseDto => ({ id, easy: false, completed: false, sets });

  it('accepts help (−10) on Tractions, sets not done, exercises left out', () => {
    expect(() => checkFinish([sent('pullups', set(0, -10), set(1, null, false))], stored)).not.toThrow();
  });

  it('rejects help on a barbell exercise, validated or just typed', () => {
    for (const done of [true, false]) {
      expect(() => checkFinish([sent('bench', set(0, -10, done))], stored)).toThrow(BadRequestException);
    }
  });

  it('rejects a set index out of range or twice, an unknown or repeated exercise', () => {
    expect(() => checkFinish([sent('bench', set(2, 60))], stored)).toThrow('set index 2 is out of range');
    expect(() => checkFinish([sent('bench', set(0, 60), set(0, 60))], stored)).toThrow(BadRequestException);
    expect(() => checkFinish([sent('curl', set(0, 10))], stored)).toThrow(BadRequestException);
    expect(() => checkFinish([sent('bench'), sent('bench')], stored)).toThrow(BadRequestException);
  });

  it('rejects a validated set without its values or its time', () => {
    expect(() => checkFinish([sent('bench', { ...set(0, 60), reps: null })], stored)).toThrow(BadRequestException);
    expect(() => checkFinish([sent('bench', { ...set(0, 60), doneAt: null })], stored)).toThrow(BadRequestException);
  });
});
