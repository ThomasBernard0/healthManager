import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(__dirname, '../prisma/migrations');
const PORTIONS = '20261014090000_portions';

const sql = (name: string) => readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8');

const food = (id: string, units: unknown) =>
  `('${id}', '${id}', '${id}', 100, 1, 1, 1, ${units === null ? 'NULL' : `'${JSON.stringify(units)}'`}, now())`;
const item = (id: string, foodId: string, grams: number, unitLabel: string | null, unitCount: number | null) =>
  `('${id}', 'm', '${foodId}', ${grams}, ${unitLabel === null ? 'NULL' : `'${unitLabel}'`}, ${unitCount ?? 'NULL'}, 0)`;

/** The portions migration on a real Postgres (in process), after every migration before it. */
describe('Portions migration', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const before = readdirSync(MIGRATIONS)
      .filter((name) => !name.endsWith('.toml') && name < PORTIONS)
      .sort();
    for (const name of before) await db.exec(sql(name));

    await db.exec(`
      INSERT INTO "Food" ("id", "name", "searchName", "kcal", "protein", "carbs", "fat", "units", "updatedAt") VALUES
        ${food('huile', [{ label: 'c. à s.', grams: 10 }])},
        ${food('oeuf', [{ label: 'pièce', grams: 55.5 }, { label: 'boîte', grams: 333 }])},
        ${food('riz', [])},
        ${food('pates', null)};
      INSERT INTO "Meal" ("id", "name", "searchName", "mode", "updatedAt") VALUES ('m', 'Repas', 'repas', 'ingredients', now());
      INSERT INTO "MealItem" ("id", "mealId", "foodId", "grams", "unitLabel", "unitCount", "position") VALUES
        ${item('i1', 'huile', 10, 'c. à s.', 1)},
        ${item('i2', 'huile', 25, null, null)},
        ${item('i3', 'oeuf', 111, 'pièce', 2)},
        ${item('i4', 'oeuf', 333, 'boîte', 1)},
        ${item('i5', 'riz', 150, null, null)};
    `);
    await db.exec(sql(PORTIONS));
  }, 60_000);
  afterAll(() => db.close());

  it('turns the first unit of a food into its portion, whatever its label', async () => {
    const { rows } = await db.query('SELECT "id", "portionGrams"::float AS "portionGrams" FROM "Food" ORDER BY "id"');
    expect(rows).toEqual([
      { id: 'huile', portionGrams: 10 },
      { id: 'oeuf', portionGrams: 55.5 },
      { id: 'pates', portionGrams: null },
      { id: 'riz', portionGrams: null },
    ]);
  });

  it('counts items entered with a unit in portions, and leaves every gram as it was', async () => {
    const { rows } = await db.query(
      'SELECT "id", "grams"::float AS "grams", "portions"::float AS "portions" FROM "MealItem" ORDER BY "id"',
    );
    expect(rows).toEqual([
      { id: 'i1', grams: 10, portions: 1 },
      { id: 'i2', grams: 25, portions: null },
      { id: 'i3', grams: 111, portions: 2 },
      // Entered with the food's second unit: counted in portions of the first one.
      { id: 'i4', grams: 333, portions: 6 },
      { id: 'i5', grams: 150, portions: null },
    ]);
  });

  it('drops the unit columns', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name IN ('Food', 'MealItem')`,
    );
    const columns = rows.map((r) => r.column_name);
    expect(columns).toEqual(expect.arrayContaining(['portionGrams', 'portions']));
    expect(columns).not.toEqual(expect.arrayContaining(['units']));
    expect(columns).not.toContain('unitLabel');
    expect(columns).not.toContain('unitCount');
  });
});
