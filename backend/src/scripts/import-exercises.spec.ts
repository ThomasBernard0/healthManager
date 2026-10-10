import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXERCISES_FILE, parseExercises } from './import-exercises.js';

const DRAWINGS = join(import.meta.dirname, '..', '..', '..', 'frontend', 'public', 'exercises');

describe('exercise bank data', () => {
  const rows = parseExercises(readFileSync(EXERCISES_FILE, 'utf8'));

  it('has every exercise once, with a primary muscle', () => {
    expect(rows.length).toBe(49);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.primaryMuscles.length).toBeGreaterThan(0);
      expect(row.secondaryMuscles.filter((m) => row.primaryMuscles.includes(m))).toEqual([]);
    }
  });

  it('has a line-art drawing for each exercise that declares one, and no stray file', () => {
    const images = rows.flatMap((r) => (r.image ? [r.image] : []));
    expect(images.length).toBe(40);
    for (const image of images) {
      expect(existsSync(join(DRAWINGS, image))).toBe(true);
      // Tinted with a CSS mask: no opaque white background shape.
      expect(readFileSync(join(DRAWINGS, image), 'utf8')).not.toMatch(/fill="#FFF"/i);
    }
    expect(readdirSync(DRAWINGS).sort()).toEqual([...images].sort());
  });

  it('maps the muscles by hand', () => {
    expect(rows.find((r) => r.name === 'Rowing barre')).toMatchObject({
      equipment: 'barbell',
      primaryMuscles: ['back'],
      secondaryMuscles: ['biceps', 'shoulders_rear'],
      image: 'rowing-barre.svg',
    });
    expect(rows.find((r) => r.name === 'Face pull')).toMatchObject({ primaryMuscles: ['shoulders_rear'], image: null });
  });

  it('rejects an unexpected file or an unknown muscle', () => {
    expect(() => parseExercises('a\tb\n1\t2')).toThrow(/header/);
    expect(() =>
      parseExercises('key\tname\tequipment\tprimary\tsecondary\teverkinetic\nx\tX\tbarbell\tlats\t\t'),
    ).toThrow(/muscle "lats"/);
  });
});
