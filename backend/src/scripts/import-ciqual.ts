import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { searchKey } from '@healthmanager/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Loads data/ciqual/ciqual-2020.tsv into Food (source "ciqual"). Runs on every deploy (start:deploy):
// new codes are inserted, existing ones are left alone; `--force` also updates existing rows.
export const CIQUAL_FILE = join(import.meta.dirname, '..', '..', 'data', 'ciqual', 'ciqual-2020.tsv');

export interface CiqualRow {
  code: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function parseCiqual(tsv: string): CiqualRow[] {
  const [header, ...lines] = tsv.trim().split(/\r?\n/);
  if (header !== 'code\tname\tkcal\tprotein\tcarbs\tfat') {
    throw new Error(`Unexpected CIQUAL header: ${header}`);
  }
  return lines.map((line) => {
    const [code, name, kcal, protein, carbs, fat] = line.split('\t');
    return {
      code,
      name,
      kcal: Number(kcal),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
    };
  });
}

const toFood = (row: CiqualRow) => ({
  name: row.name,
  searchName: searchKey(row.name),
  source: 'ciqual' as const,
  ciqualCode: row.code,
  kcal: row.kcal,
  protein: row.protein,
  carbs: row.carbs,
  fat: row.fat,
});

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const rows = parseCiqual(readFileSync(CIQUAL_FILE, 'utf8'));
    const { count } = await prisma.food.createMany({
      data: rows.map(toFood),
      skipDuplicates: true,
    });
    let updated = 0;
    if (process.argv.includes('--force')) {
      for (const row of rows) {
        await prisma.food.update({ where: { ciqualCode: row.code }, data: toFood(row) });
        updated++;
      }
    }
    console.log(`CIQUAL: ${rows.length} foods, ${count} inserted, ${updated} updated`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await main();
}
