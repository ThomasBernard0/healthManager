import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TonnageService } from './tonnage.service.js';

const row = (weight: number, reps: number, equipment: string, finishedAt: string) => ({
  weight: new Prisma.Decimal(weight),
  reps,
  sessionExercise: { exercise: { equipment }, session: { finishedAt: new Date(finishedAt) } },
});

describe('TonnageService.summary', () => {
  // Wednesday 28 October 2026: the week started on Monday 26 (Europe/Paris).
  const now = new Date('2026-10-28T12:00:00Z');
  const rows = [
    // Barbell 60 × 10·10·10·8 last week → 2 280 kg.
    ...[10, 10, 10, 8].map((reps) => row(60, reps, 'barbell', '2026-10-20T18:00:00Z')),
    // Dumbbells 14 × 10·10·9·9 this week → 2 × 14 × 38 = 1 064 kg.
    ...[10, 10, 9, 9].map((reps) => row(14, reps, 'dumbbell', '2026-10-27T18:00:00Z')),
    // Sunday 23:30 UTC is already Monday in Paris: this week.
    row(100, 1, 'machine', '2026-10-25T23:30:00Z'),
  ];
  let where: unknown;
  const prisma = {
    sessionSet: {
      findMany: (args: { where: unknown }) => {
        where = args.where;
        return Promise.resolve(rows);
      },
    },
  };
  const service = new TonnageService(prisma as unknown as PrismaService);

  it('all time and this week, × 2 for dumbbells', async () => {
    expect(await service.summary(undefined, now)).toEqual({ totalKg: 2280 + 1064 + 100, weekKg: 1064 + 100 });
  });

  it('done sets of finished sessions only, bodyweight exercises ignored, one exercise when asked', async () => {
    await service.summary('x1', now);
    expect(where).toMatchObject({
      done: true,
      sessionExercise: {
        exerciseId: 'x1',
        exercise: { equipment: { not: 'bodyweight' } },
        session: { finishedAt: { not: null } },
      },
    });
  });
});
