## 1. Stack & hosting

### Access without an account

No login screen. A long random **access key** (env var on the server). Each device asks for it once, stores it locally, and sends it as a header on every API call; wrong key → 401. Opening `/?key=…` once sets it on a new device.

### Food data

Ingredient values come from databases so you rarely type numbers: CIQUAL (French public table of generic foods, imported into the DB once) and Open Food Facts (free API, lookup by barcode scanned with the phone camera). Plus custom foods.

Repo: `apps/web`, `apps/api`, `packages/shared` (Zod schemas, nutrition and week maths); one Railway build runs both. In web: `src/modules/food` and `src/core`, so Sport/Finances can be added later as new modules. No module tabs or navigation for them yet. All UI strings in `src/i18n/fr.ts`; numbers with `Intl.NumberFormat('fr-FR')`; dates in Europe/Paris.

## 2. Data model

```ts
// Food — one ingredient
Food { id, name, brand?, source: "custom" | "ciqual" | "off", barcode?,
       per100g: Nutrients, units?: { label: string; grams: number }[], updatedAt }

// Meal — a saved meal ("Mes repas")
Meal { id, name, mode: "ingredients" | "manual",
       items: { foodId, grams }[],      // ingredients mode
       manualTotals?: Nutrients,        // manual mode
       override?: Nutrients,            // manual correction
       isFavorite, timesEaten, lastEatenAt, archived }

// LogEntry — what I ate
LogEntry { id, date /* YYYY-MM-DD */, time /* HH:mm */, kind: "meal" | "quick",
           refId?, label, quantity /* portions */, snapshot: Nutrients /* frozen at log time */, createdAt }

// Goal — versioned by day
Goal { id, validFrom /* the day it was changed */, dailyKcal,
       dailyMacros: { protein, carbs, fat } /* grams */, createdAt }

Nutrients = { kcal, protein, carbs, fat }   // all required
```

No meal-time categories: a day is one list of meals, ordered by time.

**Key rules:** every meal, food and log entry carries kcal *and* protein, carbs, fat (quick entries too). Foods are only ingredients used to build meals; you always log a meal (or a quick entry). A LogEntry stores a nutrition snapshot, so editing or deleting a meal later never changes past days.

## 3. Calculation rules

- Ingredient value = `grams / 100 × per100g`, for kcal and each macro. Units (c. à s., pièce) convert through `units[].grams`.
- Meal totals = sum of items, unless `override` or manual mode is set. Show which one is in use.
- **Week:** starts Monday 00:00 and ends the next Monday 00:00 (Europe/Paris). Never a rolling 7 days.
- **Goal for a date** = the Goal with the latest `validFrom` ≤ that date.
- **Changing the goal** takes effect **immediately**: it creates a new Goal with `validFrom` = today (saving again the same day replaces it). Today and future days use the new goal; past days keep theirs.
- **Day:** left = dailyKcal − Σ snapshots of the date. Same for each macro.
- **Week:** weekly target = sum of the daily target of each of its 7 days (= dailyKcal × 7 when the goal did not change that week); left = weekly target − Σ the week. Same for each macro.
- Over target shows the words "dépassé de N" in orange #B4510F, never colour alone.
- Store kcal as integers and macros to 0.1 g; round only in the UI.

## 4. Screens (see `design/`)

### 1 · Aujourd'hui (Jour view)

Top bar: just the module title "Alimentation" (later it becomes the switch between modules); no settings icon, no bottom tab bar. Date switcher, Jour/Semaine toggle. Ring = kcal left **today**; beside it eaten, objectif du jour with a pencil icon (tap → Mon objectif), week total (opens Semaine). Macro bars for today. One card "Repas du jour": every meal eaten that day in a single list ordered by time, each row showing time, name, P/G/L and kcal; header shows the count and the day total. No meal-time categories (no breakfast/lunch/dinner). Tap an entry: see its totals and time, delete with undo (time and portions are set when logging; no editing, no duplicating to another day). Browsing back stops at the first day with data (today when there is none); the future stays open. Floating "Ajouter" opens Ajout rapide; a meal is logged at the current time (editable).

### 2 · Ajout rapide

Bottom sheet (dialog on desktop). A search bar over **one single list, "Mes repas"**: every saved meal lives there whatever it is (shaker, fajitas, a fruit, a full dinner); no categories or tabs. Search is accent- and case-insensitive and matches anywhere in the name ("fajit" finds "Fajitas poulet"); no result → "Créer « … »" opens Nouveau repas with that name. Sort: favourites (star) first, then most eaten, then most recent. Two buttons above the list: **Nouveau repas** (a meal saved to Mes repas; barcode scanning lives inside it) and **Saisie rapide** (a one-time meal, never saved; see 3b). Each row shows kcal, P/G/L and last eaten, with "+" that logs it once, immediately (no portion stepper).

### 3 · Nouveau repas

Two modes. Par ingrédients: add foods from search or with the **Scanner** button (camera barcode scan → Open Food Facts → ask grams; on desktop, type the barcode number), set grams or a unit; each ingredient row shows its own kcal and P/G/L, and the meal total (kcal + P/G/L) is their sum, computed live. Macros always come from the ingredient (per 100 g): a food not in the database is created once as "Mon aliment" with its kcal, P, G, L per 100 g, then reused. Saisir les totaux: type kcal, protein, carbs, fat. Either way the total can be overridden. Toggles: enregistrer dans mes repas, favori (checked by default). Primary action: save and log it to today.

### 3b · Saisie rapide

For a one-time meal (restaurant, a pastry at a friend's). Fields: name (optional, default "Repas"), kcal (required), protein, carbs, fat, time (defaults to now). "Ajouter à aujourd'hui" logs it as a quick entry; it never appears in Mes repas. A link "Plutôt l'enregistrer" switches to Nouveau repas with the values kept.

### 4 · Semaine (Semaine view)

Same ring, but for the week: kcal left this week, eaten, weekly target (sum of the 7 daily targets). Per-day bars against the daily target line (over = orange), average kcal and average P/G/L per day. Tap a bar to open that day. Arrows browse past weeks.

### 5 · Mon objectif

Daily kcal stepper (±50), daily protein, carbs, fat in grams. Opened only from the pencil next to "Objectif du jour" (Jour) or "Objectif semaine" (Semaine), so goals stay inside the Food module. Meals are managed from "Gérer" next to the Mes repas list (edit, favourite, delete for good after a confirmation; days it was logged on keep their totals). The access key is asked once per device; no screen for it in the Food module.

### 6 · Desktop (≥ 1024 px)

Same routes and data, different layout. Top bar: title, date (or week) switcher with "Aujourd'hui" shortcut, Jour/Semaine toggle (no Objectifs button; same pencil icons as mobile). **Jour:** a centred column (max 1120 px): a wide summary band (ring, eaten, objectif du jour, compact macro bars, and at the right end a mini week chart with the week total and kcal left, which opens Semaine) above the full-width "Repas du jour" list with time and aligned P/G/L/kcal columns, a ⋯ menu per entry and an "Ajouter" button in its header. Everything on the page follows the selected day. "Ajouter" opens a centred dialog with the same content as mobile Ajouter un repas (Nouveau repas, Saisie rapide, search with "/" shortcut, Mes repas list) and logs to the day being viewed. **Semaine:** ring + 4 average tiles, then the per-day chart with values beside a table (kcal, P, G, L, écart) with a week total row. Nouveau repas and Mon objectif open as centred dialogs (max 560 px). Below 1024 px the columns wrap and the mobile layout applies.

## 5. Visual language

| Token | Value |
|---|---|
| Ground | `#F3F4EF` |
| Card | `#FFFFFF` |
| Ink | `#17201B` |
| Muted text | `#5B655F` |
| Accent / on target | `#1E6B47` |
| Over target | `#B4510F` |
| Protéines | `#2F5D8A` |
| Glucides | `#C98A1B` |
| Lipides | `#7A4E91` |

Space Grotesk for numbers and headings, IBM Plex Sans for text. White cards, 16–20 px radius, 44 px minimum touch targets, muted text #5B655F. Macro abbreviations in lists: P (protéines), G (glucides), L (lipides). **Personal app: no helper or explanatory text anywhere** (no banners, hints, "s'applique…", "ces macros font…", source labels); only labels, values and actions. Add a dark theme from the same tokens.

## 6. Build order

1.  **Foundation** — monorepo, API with access-key check, DB schema and migrations, Railway deploy (service + Postgres), app shell, Mon objectif (applies immediately), Aujourd'hui with Saisie rapide only.
2.  **Foods & meals** — custom foods, CIQUAL import, Nouveau repas (both modes), saved meals, the Mes repas list with search, one-tap re-log.
3.  **Semaine** — weekly ring, chart, averages, day drill-down, past weeks.
4.  **Desktop** — three-column Jour, Semaine with table, dialogs.
5.  **Extras** — barcode scan with Open Food Facts, PWA install.
6.  **Later** — Sport module (does not change food targets), then Finances.

## 7. Acceptance checks

- Logging a saved meal takes at most 2 taps from Aujourd'hui.
- An entry logged on the phone appears on the desktop after refresh.
- API calls without the right key return 401 and show the key prompt.
- Editing a saved meal leaves earlier days' totals unchanged.
- Raising the daily goal from 2 200 to 2 400 on a Wednesday: Mon–Tue keep 2 200, Wed–Sun use 2 400, weekly target = 2×2 200 + 5×2 400 = 16 400.
- A meal logged Sunday 23:30 counts in that week; Monday 00:10 counts in the next one.
- Week total equals the sum of its seven days.
- No English text visible anywhere in the UI.
