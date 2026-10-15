import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(__dirname, '../prisma/migrations');
const FINANCES = '20261015090000_finances';

const sql = (name: string) =>
  readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8');
const insert = (
  id: string,
  kind: string,
  amountCents: number,
  category: string | null,
) =>
  `INSERT INTO "FinanceLine" ("id", "kind", "name", "amountCents", "category", "updatedAt")
   VALUES ('${id}', '${kind}', '${id}', ${amountCents}, ${category === null ? 'NULL' : `'${category}'`}, now())`;

/** The finances migration on a real Postgres (in process), after every migration before it. */
describe('Finances migration', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const upTo = readdirSync(MIGRATIONS)
      .filter((name) => !name.endsWith('.toml') && name <= FINANCES)
      .sort();
    for (const name of upTo) await db.exec(sql(name));
  });

  afterAll(() => db.close());

  it('stores an expense with its category and an income without', async () => {
    await db.exec(insert('loyer', 'expense', 85_000, 'housing'));
    await db.exec(insert('salaire', 'income', 265_000, null));
    const { rows } = await db.query(
      'SELECT "id" FROM "FinanceLine" ORDER BY "id"',
    );
    expect(rows).toEqual([{ id: 'loyer' }, { id: 'salaire' }]);
  });

  it.each([
    ['an expense without a category', insert('a', 'expense', 1, null)],
    ['an income with a category', insert('b', 'income', 1, 'savings')],
    ['amount 0', insert('c', 'expense', 0, 'other')],
  ])('rejects %s', async (_, statement) => {
    await expect(db.exec(statement)).rejects.toThrow(/check constraint/);
  });
});
