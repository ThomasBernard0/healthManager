// Builds frontend/public/exercises/<key>.svg from the Everkinetic drawings (CC BY-SA 4.0,
// https://github.com/everkinetic/data) listed in exercises.tsv. Run by hand when the list changes:
//   node backend/data/exercises/convert.mjs
// Each drawing ("tension" position) is kept as line art only: the white background shape is removed,
// so the app can tint the lines with the theme (CSS mask).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', '..', 'frontend', 'public', 'exercises');
const SOURCE = 'https://raw.githubusercontent.com/everkinetic/data/main/dist/svg';

/** Removes the white background group and the hard-coded size (the viewBox stays). */
export function lineArt(svg) {
  const cleaned = svg
    .replace(/<g fill="#FFF">[\s\S]*?<\/g>/i, '')
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/fill="#FFF"/i.test(cleaned) || !/viewBox=/.test(cleaned)) throw new Error('Unexpected SVG');
  return cleaned;
}

mkdirSync(out, { recursive: true });
const rows = readFileSync(join(here, 'exercises.tsv'), 'utf8').trim().split(/\r?\n/).slice(1);
let written = 0;
for (const row of rows) {
  const [key, , , , , everkinetic] = row.split('\t');
  if (!everkinetic) continue;
  const res = await fetch(`${SOURCE}/${everkinetic}-tension.svg`);
  if (!res.ok) throw new Error(`${everkinetic}: HTTP ${res.status}`);
  writeFileSync(join(out, `${key}.svg`), lineArt(await res.text()) + '\n');
  written++;
}
console.log(`${written} drawings written to ${out}`);
