## 1. Stack & hosting

### Access without an account

No login screen. A long random **access key** (env var on the server). Each device asks for it once, stores it locally, and sends it as a header on every API call; wrong key → 401. Opening `/?key=…` once sets it on a new device.

### Food data

Ingredient values come from Open Food Facts (free API, lookup by barcode scanned with the phone camera) so you rarely type numbers. Plus custom foods.

Repo: `apps/web`, `apps/api`, `packages/shared` (Zod schemas, nutrition and week maths); one Railway build runs both. In web: `src/modules/food` and `src/core`, so Sport/Finances can be added later as new modules. No module tabs or navigation for them yet. All UI strings in `src/i18n/fr.ts`; numbers with `Intl.NumberFormat('fr-FR')`; dates in Europe/Paris.

## 2. Data model

```ts
// Food — one ingredient
Food { id, name, brand?, barcode?,
       per100g: Nutrients, portionGrams? /* weight of one portion */, updatedAt }

// Meal — a saved meal ("Mes repas")
Meal { id, name, mode: "ingredients" | "manual",
       items: { foodId, grams, portions? }[], // ingredients mode; portions = count when entered in portions (display)
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

- Ingredient value = `grams / 100 × per100g`, for kcal and each macro. A quantity in portions converts through `portionGrams` (grams = portions × portionGrams).
- Food entered **per portion**: `per100g = value × 100 / portionGrams` (kcal rounded to the unit, macros to 0.1 g), then checked with the same per-100 g plausibility rule.
- **Macro order everywhere: Protéines, Lipides, Glucides** (inputs, "P · L · G" lines, tables, totals); carbs always last.
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

Top bar: just the module title "Alimentation" (later it becomes the switch between modules); no settings icon, no bottom tab bar. Date switcher, Jour/Semaine toggle. Ring = kcal left **today**; beside it eaten, objectif du jour with a pencil icon (tap → Mon objectif), week total (opens Semaine). Macro bars for today. One card "Repas du jour": every meal eaten that day in a single list ordered by time, each row showing time, name, P/L/G and kcal; header shows the count and the day total. No meal-time categories (no breakfast/lunch/dinner). Tap an entry: its totals and delete with undo; nothing is editable (the time, set when logging, shows in the list only; no portions, no duplicating to another day). Browsing back stops at the first day with data (today when there is none); the future stays open. Floating "Ajouter" opens Ajout rapide; a meal is logged at the current time (editable).

### 2 · Ajout rapide

Bottom sheet (dialog on desktop). A search bar over **one single list, "Mes repas"**: every saved meal lives there whatever it is (shaker, fajitas, a fruit, a full dinner); no categories or tabs. Search is accent- and case-insensitive and matches anywhere in the name ("fajit" finds "Fajitas poulet"); no result → "Créer « … »" opens Nouveau repas with that name. Sort: favourites (star) first, then most eaten, then most recent. One button above the list, **Saisie rapide** (a one-time meal, never saved; see 3b); **Nouveau repas** (a meal saved to Mes repas; barcode scanning lives inside it) is a small link next to "Gérer" in the Mes repas header, since it is used less once Mes repas is set up. Each row shows kcal, P/L/G and last eaten, with "+" that logs it once, immediately (no portion stepper).

### 3 · Nouveau repas

Two modes. Par ingrédients: add foods from search or with the **Scanner** button (camera barcode scan → Open Food Facts → ask grams; phone only: no Scanner on desktop), set grams or portions; each ingredient row shows its own kcal and P/L/G, and the meal total (kcal + P/L/G) is their sum, computed live. Macros always come from the ingredient (per 100 g): a food not in the database is created once as "Mon aliment" (see 3c), then reused. Saisir les totaux: type kcal, protein, fat, carbs. Either way the total can be overridden. The mode is chosen when the meal is created; editing a saved meal shows its mode but cannot switch it (that would drop its ingredients or its typed totals). Toggles: enregistrer dans mes repas (checked by default), favori (unchecked by default). Primary action: save and log it to today, at the current time (no time field). Opens as a modal over the page (bottom sheet on mobile, dialog on desktop).

### 3c · Mon aliment (`design/meal/mobile-3c-aliment-pour-100g`, `mobile-3c-aliment-par-portion`, `mobile-3c-quantite-portions`)
Create or edit an ingredient. Fields, top to bottom: **Nom**, a segmented control **Pour 100 g | Par portion**, then:
- **Pour 100 g**: Calories, Protéines, Lipides, Glucides for 100 g. No portion field: the food is dosed in grams only.
- **Par portion**: **Poids d'une portion** (g, required, > 0), then Calories, Protéines, Lipides, Glucides for one portion, and a read-only line "Pour 100 g · 113 kcal · P 21 · L 3 · G 1" computed live. Saved as `per100g` + `portionGrams`.
- Creating: switching the control keeps the numbers typed (no conversion). Editing: a food with `portionGrams` opens in Par portion with its per-portion values (computed from per100g); switching to Pour 100 g shows its per-100 g values, and saving there removes the portion (dosed in grams only from then on).
- Scanned products: Open Food Facts values are per 100 g; a declared serving size fills `portionGrams` (as today's "portion" unit).

**Quantity of an ingredient** (in a meal): a food with a portion opens in portions (default 1) with a segmented control **En portions | En grammes** under the big quantity field; the unit shown after the number is "portion(s)" or "g". A food without a portion has grams only (no control). Preview: kcal and "P · L · G".

### 3b · Saisie rapide

For a one-time meal (restaurant, a pastry at a friend's). Fields: name (optional, default "Repas"), kcal (required), protein, fat, carbs (no time field: logged at the current time). "Ajouter à aujourd'hui" logs it as a quick entry; it never appears in Mes repas. A link "Plutôt l'enregistrer" switches to Nouveau repas with the values kept.

### 4 · Semaine (Semaine view)

Same ring, but for the week: kcal left this week, eaten, weekly target (sum of the 7 daily targets). Per-day bars against the daily target line (over = orange), average kcal and average P/L/G per day. Tap a bar to open that day. Arrows browse past weeks.

### 5 · Mon objectif

Daily kcal stepper (±50), daily protein, carbs, fat in grams. Opened only from the pencil next to "Objectif du jour" (Jour) or "Objectif semaine" (Semaine), so goals stay inside the Food module. Meals are managed from "Gérer" next to the Mes repas list (Mes repas and Modifier le repas open as modals over the page, like Nouveau repas and Mon objectif) (edit, favourite, delete for good after a confirmation; days it was logged on keep their totals). That page has two tabs, **Repas | Ingrédients**: the second lists every ingredient (search, "+ Nouvel ingrédient"); tapping one opens Mon aliment (3c) to edit it (saved meals using it follow, logged days don't), and the bin deletes it after a confirmation — refused while a saved meal uses it, naming one such meal ("Utilisé dans le repas « X »"). The access key is asked once per device; no screen for it in the Food module.

### 6 · Desktop (≥ 1024 px)

Same routes and data, different layout. Top bar: title, date (or week) switcher with "Aujourd'hui" shortcut, Jour/Semaine toggle (no Objectifs button; same pencil icons as mobile). **Jour:** a centred column (max 1120 px): a wide summary band (ring, eaten, objectif du jour, compact macro bars, and at the right end a mini week chart with the week total and kcal left, which opens Semaine) above the full-width "Repas du jour" list with time and aligned P/L/G/kcal columns, a ⋯ menu per entry and an "Ajouter" button in its header. Everything on the page follows the selected day. "Ajouter" opens a centred dialog with the same content as mobile Ajouter un repas (Nouveau repas, Saisie rapide, search with "/" shortcut, Mes repas list) and logs to the day being viewed. **Semaine:** ring + 4 average tiles, then the per-day chart with values beside a table (kcal, P, L, G, écart) with a week total row. Nouveau repas and Mon objectif open as centred dialogs (max 560 px). Below 1024 px the columns wrap and the mobile layout applies.

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
2.  **Foods & meals** — custom foods, Nouveau repas (both modes), saved meals, the Mes repas list with search, one-tap re-log.
3.  **Semaine** — weekly ring, chart, averages, day drill-down, past weeks.
4.  **Desktop** — three-column Jour, Semaine with table, dialogs.
5.  **Extras** — barcode scan with Open Food Facts, PWA install.
5b. **Portions** — Mon aliment per 100 g or per portion, quantity in portions or grams, carbs last everywhere (see the README of this handoff).
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
- Jambon created Par portion, 40 g, 45 kcal · P 8,4 · L 1,2 · G 0,4 → stored per 100 g as 113 kcal · P 21 · L 3 · G 1 with `portionGrams` 40.
- Adding it to a meal opens at "1 portion"; 2 portions → 80 g, 90 kcal · P 17 · L 2 · G 1; "En grammes" shows 80 g.
- A food created Pour 100 g has no portion and no En portions | En grammes control.
- Editing a food with a portion opens in Par portion; saving it in Pour 100 g removes the portion (meals keep their grams).
- Every macro input and every "P · L · G" line lists carbs last.
