# Musculation module — spec

Second module of healthManager, next to Alimentation. Same stack, same conventions (CLAUDE.md), same theme tokens, French UI, no helper text. Mockups: `design/musculation/` (dark theme, as the app renders on the user's devices).

**Context:** one user, about 15 exercises, 3 fixed sessions in rotation of ~5 exercises × 4 sets (Push A → Pull → Push B → …), machines and free weights, rep ranges mostly 8–12. No rest timer. Sport never changes food targets.

## 1. Navigation

- The module title in the top bar ("Alimentation" today) becomes a **module switcher**: title + chevron, opens a small menu listing the modules (Alimentation, Musculation). Same on mobile and desktop. Remember the last module per device and open it at launch.
- Routes under `/muscu/*`. Code in `frontend/src/modules/muscu/`, backend domains `exercises/`, `workouts/`, `sessions/` (one Nest module each).

## 2. Data model

```ts
// Exercise — the exercise bank (seeded, editable)
Exercise { id, name, equipment: "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight",
           primaryMuscles: Muscle[], secondaryMuscles: Muscle[],
           imageUrl?, archived }

// Workout — a session template ("Push A")
Workout { id, name, position /* order in the rotation */,
          items: { exerciseId, sets /* default 4 */, repMin /* 8 */, repMax /* 12 */, order }[] }

// Session — one performed workout
Session { id, workoutId, startedAt, finishedAt? }
SessionExercise { id, sessionId, exerciseId, order, feeling?: "easy" | "ok" | "hard",
                  sets: { targetWeight?, targetReps?, weight /* kg, 0.5 step */, reps, done }[] }

// Next targets are computed from the last SessionExercise of the exercise (no stored table).
// A manual override is just editing the numbers during the session.

Muscle = "chest" | "back" | "shoulders_front" | "shoulders_side" | "shoulders_rear" | "biceps"
       | "triceps" | "forearms" | "abs" | "quads" | "hamstrings" | "glutes" | "calves"
```

- Exercise bank seeded from **free-exercise-db** (public domain, images + muscles), names translated to French, only the ~40 most common exercises imported. Images stored with the app, not hot-linked. Never Basic-Fit images.
- **Next workout** = the workout after the last finished session in `position` order (wraps around). The user can start any other one ("Démarrer cette séance", a link at the bottom of Modifier la séance); the rotation then continues after the one finished.

## 3. Progression rules (double progression)

**First time** an exercise is done: no target. The user types weight and reps for each set; that session becomes the reference.

**Afterwards**, targets for each set come from the last time the exercise was done (its sets, their weights and reps, and the feeling). The session is judged on the **total reps**, not on the worst set, so a weaker last set (normal fatigue) neither blocks progress nor triggers a drop. With `N` = number of sets and `total` = Σ reps:

| Last time (first matching row wins) | Next time |
|---|---|
| **Up**: `total ≥ N × (repMax − 1)` (4 × 8–12 → ≥ 44), or feeling **Facile** with `total ≥ N × repMin` | every set: `stepUp(weight)`; target reps = `repMin` |
| **Down**: `total < N × repMin` (4 × 8–12 → < 32) in this session **and** the previous one, the second not explained by more pre-fatigue | every set: `stepDown(weight)`; target reps = `repMin` |
| Feeling **Dur**, or `total < N × repMin` (first time) | same weights; each set keeps **last time's target** (retried, never lowered to what was done) |
| Otherwise (feeling **OK** or none) | same weights; each set: target reps = reps done + 1, capped at `repMax` |

- The +1 per set capped at `repMax` rebalances reps by itself: strong sets stop at the top while weaker ones catch up, until the total reaches the Up threshold.
- **Drop sets / different weights per set**: each set keeps its own weight. All sets move together by one step (`stepUp`/`stepDown` applied to each), so the shape is kept (60/57,5/55 → 62,5/60/57,5). The app reproduces what was done; it never proposes drop sets on its own.
- The number of sets is fixed by the workout (Modifier la séance); the exercise screen has no "+ Série". If the set count of a workout item changes, new sets copy the last set's target.
- Exercises skipped in a session don't change their next target.
- An exercise **stopped early** (not every set done) doesn't move it either: next time its targets are retried (never up, never down), and it never counts as one of the two sessions in a row for a drop.
- No 1RM formula: increments must match real plates and machine stacks.
- Pure functions in `shared/` with unit tests for every row, drop sets and first time.

### Available weights (learned, no setting)
- **Known weights** of an exercise = the distinct weights already logged for it (derived from history, no table). Fixing a typo in a past set removes the wrong weight automatically.
- Default step by equipment: barbell 2.5, dumbbell 2, machine 5, cable 2.5, bodyweight 2.5 (added load).
- `stepUp(current, known, step)`: the first known weight above `current` if it is ≤ `current + 2 × step`, else `current + step`. `stepDown` mirrors it (never below 0).
- "+1 step" / "−1 step" in the rules always call `stepUp` / `stepDown` (only used to compute targets; no stepper in the UI).
- The app never needs to know *why* a different weight was typed: whatever was done is recorded, becomes a known weight, and the next targets start from it.
- Example: machine, 8 kg Facile → 13 (8 + 5). Dumbbells 10 kg Facile → 12; user types 12,5 because 12 doesn't exist; next time from 10 → 12,5 directly.
- Pure functions in `shared/` with tests (no known weight above, known weight too far, typo removed).

### Order and skipped exercises (fatigue)
Exercises can be done in any order and some can be skipped, so the same exercise is not always done in the same state.
- The app records the real order (time of the first set of each exercise).
- **Pre-fatigue** of an exercise = sets already done earlier in the same session that hit its muscles: an earlier exercise sharing one of its primary muscles counts 1 per set if that muscle is primary there, ½ if secondary. Example: bench press after 3 sets of dips → 3; after curls → 0; with dips skipped → 0.
- The rules always compare with the **last** time the exercise was done (no data is thrown away), and pre-fatigue only adjusts them, asymmetrically:
  - more pre-fatigue than last time and the result is worse → not a failure: weights unchanged, not counted toward the two-sessions-in-a-row drop;
  - more pre-fatigue and the result is as good or better → counts normally;
  - less pre-fatigue and a success → counts normally (a later harder session simply keeps the weight).
- When an exercise is opened with more pre-fatigue than last time, today's target reps = last reps (no +1).
- No fatigue percentage or coefficient.
- Not displayed: pre-fatigue only feeds the rules above (no battery icon, no "{muscle} déjà travaillé" tag).

### Showing target vs done
- Each set row shows **Objectif** (e.g. "60 × 10", muted) then the two inputs. Inputs are empty with the target as placeholder; ✓ with empty inputs records the target as done, so a set done as planned is one tap.
- Once validated: weight and reps in full colour; reps ≥ target in accent, reps < target in the "over" colour (orange). Tapping ✓ again reopens the row.
- First time: Objectif shows "—" and inputs have no placeholder.

## 4. Screens

### Accueil (mobile `muscu-1-accueil`, desktop `bureau-muscu-accueil`)
- **Prochaine séance** card: workout name, its exercise names (desktop: each with its target), date of the last time, big **Démarrer**.
- **Mes séances**: workouts in rotation order with exercise count and last date; the next one tagged "Suivante". Tap → edit. "+ Nouvelle séance".
- **Mes exercices** (mobile: between Prochaine séance and Mes séances; desktop: right column, Prochaine séance and Mes séances stacked on the left): every exercise used in my séances, once, by name → its Fiche exercice. No link to the bank on Accueil (it is reached from Modifier la séance).
- No session history on this page (progress lives in each exercise page).

### Séance — liste (mobile `muscu-2-seance-liste`; desktop: same screen centred, max 560 px)
- Opens on **Démarrer**. Header: close (confirm if sets were logged), workout name, "2 / 5 faits".
- One card per exercise, any order: thumbnail, name, and status only (✓ when done — name muted —, "En cours" outlined, chevron when to do). **No targets and no results in the list**; they appear when the exercise is opened.
- **Terminer la séance** saves the session; exercises not done are ignored.
- A started session survives reloads (saved after every set).

### Exercice en cours (mobile `muscu-3-exercice-en-cours`)
- Back arrow → list (progress kept). Image, name, "4 × 8–12".
- Set rows: Objectif | kg | Reps | ✓ (see 3, "Showing target vs done"). All rows have the same height; weight and reps are typed manually (no − / + buttons). Sets are done **in order**: only the next set has inputs, later ones are locked (their target, read-only); any validated set can be reopened to fix it.
- "Dernière fois · date": sets in the compact format below.
- **Ressenti**: Facile / OK / Dur (single choice, optional).
- **Terminé** (once every set is done) → back to the list. Not the usual flow: a small "Terminer l'exercice plus tôt" link (after at least one set) asks "Terminer avec 2 / 4 séries ?" first.

### Fiche exercice (mobile `muscu-4-fiche-exercice`, desktop `bureau-muscu-exercice`)
- Name, equipment · workout · sets × rep range, pencil → Modifier l'exercice.
- One image of the exercise with the muscles as pills overlaid at its bottom: primary filled accent, secondary outlined. No muscle map, no next-target block.
- **Progression**: one combined chart per session over the last 12 weeks — bars = volume (Σ weight × reps), line = heaviest weight. No summary numbers. Tapping a bar highlights it and shows a small callout above it: date, sets (compact format), volume. Tap elsewhere to hide.
- **Historique**: date, sets in the compact format, feeling (desktop: table, one column per set + volume).

### Modifier la séance (mobile `muscu-5-modifier-seance`)
- Name, ordered exercise list (drag handle), each with its "sets × min–max" chip (tap to edit), swipe to remove, "+ Ajouter un exercice" → bank in picking mode. Delete workout in the header.

### Exercices (mobile `muscu-6-exercices`)
- Search (accent/case-insensitive) and the list (thumbnail, name, muscles · equipment). No filters. Opened from a workout (picker in Modifier la séance): "+" adds to it; exercises already in it show the workout name; "+ Créer un exercice" creates a custom exercise and adds it to the workout.

### Compact set format
Consecutive sets at the same weight are grouped: "60 kg × 10 · 9 · 9 · 8". A weight change starts a new line (mobile) or group: "57,5 kg × 11 · 10" / "55 kg × 10 · 9". Keeps 4–5 sets readable on a phone.

### Modifier l'exercice (mobile `muscu-7-modifier-exercice`)
- Name; muscles as toggle pills (tap: none → secondary (outlined) → primary (filled) → none), legend Principal / Secondaire; image (change / take photo). Enregistrer. No weight settings (weights are learned).

## 5. Build order

1. Module switcher + empty Musculation module and routes.
2. Exercise bank: schema, seed import, Exercices screen, Fiche exercice without chart.
3. Workouts: create/edit, rotation, Accueil.
4. Séance: list, exercise logging with target vs done, resume after reload, Terminer.
5. Progression rules in `shared/` + targets.
6. Combined chart, history, desktop layouts.

## 6. Acceptance checks

- After finishing Push A, Accueil proposes Pull; after Push B, it proposes Push A.
- Exercises can be done in any order from the list; skipped ones keep their target.
- 4 × 8–12, 50 kg, done 12·12·12·8 (total 44) → next time one step up, targets × 8·8·8·8.
- Done 11·11·11·10 (total 43), "OK" → 50 × 12·12·12·11; done as targeted (total 47) → step up the time after.
- Done 12·12·12·7 (total 43), "OK" → 50 × 12·12·12·8; never counts toward a drop.
- Target 50 × 10·10·10·10, done 10·10·10·8, "OK" → 50 × 11·11·11·9; "Dur" → 50 × 10·10·10·10.
- Reps rebalance: 10·10·10·8 → 11·11·11·9 → 12·12·12·10 (total 46) → next weight (all "OK", targets met).
- 57,5 × 12·12·11·10 (total 45) → 60 × 8·8·8·8, whatever the feeling.
- Done 9·9·8·7 (total 33, ≥ 32) "Facile" → step up.
- Done 7·7·6·6 (total 26) twice in a row, same pre-fatigue → every weight one step down, targets × 8; the second time with more pre-fatigue → no drop.
- Dumbbells 10 kg "Facile", user logs 12,5 → next time a step up from 10 kg gives 12,5.
- Known weights {8, 30}: stepping up from 8 (machine) gives 13, not 30.
- Drop set 60×12 · 57,5×12 · 55×12 → 62,5 · 60 · 57,5.
- ✓ on an empty row records the target; a set done under target shows its reps in orange.
- Reloading the page in the middle of a session keeps every validated set.
- Food pages are unchanged except the switcher in the top bar.
