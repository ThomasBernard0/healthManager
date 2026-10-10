import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EQUIPMENTS, MUSCLES, searchKey, type Equipment, type Muscle } from '@healthmanager/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Loads data/exercises/exercises.tsv (French names, muscles mapped by hand) into Exercise. Runs on every
// deploy (start:deploy): new keys are inserted, existing ones are left alone (they may have been edited in
// the app); `--force` also updates existing rows.
// Drawings: frontend/public/exercises/<key>.svg, built from Everkinetic by data/exercises/convert.mjs.
export const EXERCISES_FILE = join(import.meta.dirname, '..', '..', 'data', 'exercises', 'exercises.tsv');

export interface ExerciseRow {
  key: string;
  name: string;
  equipment: Equipment;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  /** File in frontend/public/exercises/, when the exercise has a drawing. */
  image: string | null;
}

function muscles(cell: string, line: string): Muscle[] {
  const list = cell ? cell.split(',') : [];
  for (const m of list) {
    if (!(MUSCLES as readonly string[]).includes(m)) throw new Error(`Unknown muscle "${m}" in: ${line}`);
  }
  return list as Muscle[];
}

export function parseExercises(tsv: string): ExerciseRow[] {
  const [header, ...lines] = tsv.trim().split(/\r?\n/);
  if (header !== 'key\tname\tequipment\tprimary\tsecondary\teverkinetic') {
    throw new Error(`Unexpected exercises header: ${header}`);
  }
  return lines.map((line) => {
    const [key, name, equipment, primary, secondary, everkinetic] = line.split('\t');
    if (!(EQUIPMENTS as readonly string[]).includes(equipment)) {
      throw new Error(`Unknown equipment "${equipment}" in: ${line}`);
    }
    return {
      key,
      name,
      equipment: equipment as Equipment,
      primaryMuscles: muscles(primary, line),
      secondaryMuscles: muscles(secondary, line),
      image: everkinetic ? `${key}.svg` : null,
    };
  });
}

const toExercise = (row: ExerciseRow) => ({
  name: row.name,
  searchName: searchKey(row.name),
  equipment: row.equipment,
  primaryMuscles: row.primaryMuscles,
  secondaryMuscles: row.secondaryMuscles,
  bankKey: row.key,
  image: row.image,
});

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const rows = parseExercises(readFileSync(EXERCISES_FILE, 'utf8'));
    const { count } = await prisma.exercise.createMany({ data: rows.map(toExercise), skipDuplicates: true });
    let updated = 0;
    if (process.argv.includes('--force')) {
      for (const row of rows) {
        await prisma.exercise.update({ where: { bankKey: row.key }, data: toExercise(row) });
        updated++;
      }
    }
    console.log(`Exercises: ${rows.length} in the bank, ${count} inserted, ${updated} updated`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await main();
}
