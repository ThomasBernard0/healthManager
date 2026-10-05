// Converts the official ANSES CIQUAL 2020 XML export into ciqual-2020.tsv (committed).
// Only needed when a new CIQUAL release comes out:
//   1. download https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip
//   2. unzip it somewhere
//   3. node data/ciqual/convert.mjs <unzipped folder>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node convert.mjs <folder with alim_*.xml and compo_*.xml>');

/** The CIQUAL files are windows-1252 encoded. */
const read = (prefix) => {
  const file = readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith('.xml'));
  if (!file) throw new Error(`${prefix}*.xml not found in ${dir}`);
  return new TextDecoder('windows-1252').decode(readFileSync(join(dir, file)));
};

const CONSTITUENTS = {
  328: 'kcal', // Energie, Règlement UE N° 1169/2011 (kcal/100 g)
  333: 'kcalJones', // Energie, N x facteur Jones, avec fibres (kcal/100 g) — fallback
  25000: 'protein', // Protéines, N x facteur de Jones (g/100 g)
  31000: 'carbs', // Glucides (g/100 g)
  40000: 'fat', // Lipides (g/100 g)
};

const field = (block, tag) => block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1].trim();

/** "12,5" → 12.5 · "traces" / "< 0,5" → 0 · "-" / empty → null */
function value(raw) {
  if (!raw || raw === '-') return null;
  if (raw === 'traces' || raw.startsWith('<')) return 0;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const foods = new Map();
for (const [, block] of read('alim_').matchAll(/<ALIM>([\s\S]*?)<\/ALIM>/g)) {
  foods.set(field(block, 'alim_code'), { name: field(block, 'alim_nom_fr'), values: {} });
}

for (const [, block] of read('compo_').matchAll(/<COMPO>([\s\S]*?)<\/COMPO>/g)) {
  const key = CONSTITUENTS[field(block, 'const_code')];
  if (!key) continue;
  const food = foods.get(field(block, 'alim_code'));
  if (food) food.values[key] = value(field(block, 'teneur'));
}

const round1 = (n) => Math.round(n * 10) / 10;
const rows = [];
let skipped = 0;
for (const [code, { name, values }] of foods) {
  const protein = values.protein ?? 0;
  const carbs = values.carbs ?? 0;
  const fat = values.fat ?? 0;
  let kcal = values.kcal ?? values.kcalJones;
  // No energy value: derive it from the macros (4/4/9), if there are any.
  if (kcal == null && (values.protein != null || values.carbs != null || values.fat != null)) {
    kcal = 4 * protein + 4 * carbs + 9 * fat;
  }
  if (kcal == null || !name) {
    skipped++;
    continue;
  }
  rows.push([code, name.replace(/\s+/g, ' '), Math.round(kcal), round1(protein), round1(carbs), round1(fat)]);
}
rows.sort((a, b) => Number(a[0]) - Number(b[0]));

const out = new URL('./ciqual-2020.tsv', import.meta.url);
writeFileSync(out, ['code\tname\tkcal\tprotein\tcarbs\tfat', ...rows.map((r) => r.join('\t'))].join('\n') + '\n');
console.log(`${rows.length} foods written, ${skipped} skipped (no energy value)`);
