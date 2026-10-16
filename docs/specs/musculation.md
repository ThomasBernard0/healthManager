# Musculation module — spec

Second module of healthManager, next to Alimentation. Same stack, same conventions (CLAUDE.md), same theme tokens, French UI, no helper text. Mockups: `design/musculation/` (`muscu-*`, `bureau-muscu-*`, `superset-*`; dark theme, as the app renders on the user's devices).

Supersets (§5) and sets/rep range on the exercise are part of this spec; it replaces `musculation-superset.md`.

**Context:** one user, about 15 exercises, 3 fixed sessions in rotation of ~5 exercises × 4 sets (Push A → Pull → Push B → …), machines and free weights, rep ranges mostly 8–12. Sessions are grouped in **programs** (e.g. a summer program and a winter one); only one is active at a time and its sessions are the rotation. No rest timer. Sport never changes food targets.

## 1. Navigation

- The module title in the top bar ("Alimentation" today) becomes a **module switcher**: title + chevron, opens a small menu listing the modules (Alimentation, Musculation). Same on mobile and desktop. Remember the last module per device and open it at launch.
- Routes under `/muscu/*`. Code in `frontend/src/modules/muscu/`, backend domains `exercises/`, `programs/`, `workouts/`, `sessions/` (one Nest module each).

## 2. Data model

```ts
// Exercise — my exercises (created in the app, editable)
Exercise { id, name, equipment: "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight",
           primaryMuscles: Muscle[], secondaryMuscles: Muscle[],
           sets /* default 4 */, repMin /* default 8 */, repMax /* default 12 */,
           image? /* uploaded picture, stored in the database */, archived }

// Program — a group of workouts; exactly one is active
Program { id, name, position /* order in Mes programmes */, active, activatedAt /* last activation */ }

// Workout — a session template ("Push A"), in one program
Workout { id, programId, name, position /* order in its program's rotation */,
          items: { exerciseId, order, supersetGroup? /* shared by exactly two adjacent items */ }[] }

// Session — one performed workout
Session { id, workoutId, startedAt, finishedAt? }
SessionExercise { id, sessionId, exerciseId, order, repMin, repMax /* snapshot of the exercise at start */,
                  firstSetAt?, preFatigue?, completed, supersetGroup? /* snapshot of the workout item */,
                  easy: boolean /* "Facile" tapped */,
                  sets: { index, targetWeight?, targetReps?, weight /* kg, 0.5 step; < 0 = assistance (bodyweight only) */, reps, done, doneAt? }[] }
// The number of SessionSet rows created at start = the exercise's `sets` at that time.

// Next targets are computed from the last SessionExercise of the exercise (no stored table).
// A manual override is just editing the numbers during the session.

Muscle = "chest" | "back" | "shoulders_front" | "shoulders_side" | "shoulders_rear" | "biceps"
       | "triceps" | "forearms" | "abs" | "quads" | "hamstrings" | "glutes" | "calves"
```

- No seeded exercise bank: exercises are created in the app. An exercise can have one image, uploaded from Créer / Modifier l'exercice and stored in the database (served by the API, not with the app). Never Basic-Fit images.
- **Sets and rep range belong to the exercise**, not to the workout: the same exercise has the same scheme in every workout, so its history, chart and progression stay comparable. Each session snapshots the scheme when it starts (set rows + `repMin`/`repMax`), so changing the exercise later never rewrites past sessions.
- **Programs**: there is always exactly one active program (the existing workouts went into "Mon programme", active). A new program is created inactive. **Activer** makes it the only active one and its rotation **restarts at its first workout** (also when re-activating a program used before). The active program can't be deleted; deleting another one deletes its workouts (the history of their sessions is kept).
- **Next workout** = in the active program, the workout after the last session finished since its activation, in `position` order (wraps around); none yet → its first workout. The user can start any other workout of the active program ("Démarrer cette séance", a link at the bottom of Modifier la séance); the rotation then continues after the one finished. Workouts of an inactive program can't be started (no link, and the API refuses).

## 3. Progression rules (double progression)

**First time** an exercise is done: no target. The user types weight and reps for each set; that session becomes the reference.

**Afterwards**, targets for each set come from the last time the exercise was done (its sets, their weights and reps, and whether **Facile** was tapped). The session is judged on the **total reps**, not on the worst set, so a weaker last set (normal fatigue) neither blocks progress nor triggers a drop.

**Step 1 — harmonize a lone off-weight set.** Before judging, look at the weights of last time's sets:
- all at the same weight → nothing to do;
- **all at the same weight except exactly one set** (heavier or lighter, in the range or not) → that set was an adjustment (wrong setting, fatigue drop), not a plan. It is set aside: the session is judged on the sets at the common weight only (`N` = their count, `total` = their reps), and next time **every set** gets the common weight. The off-weight set stays in the history and its weight stays a known weight;
- no single common weight with one exception (e.g. 60 / 57,5 / 55, or 2 heavy + 2 light) → real drop sets: see "Drop sets" below.

**Step 2 — judge and set targets.** With `N` = number of (kept) sets and `total` = Σ their reps:

| Last time (first matching row wins) | Next time |
|---|---|
| **Up**: `total ≥ N × (repMax − 1)` (4 × 8–12 → ≥ 44), or **Facile** with `total ≥ N × repMin` | every set: `stepUp(weight)`; target reps = `repMin` |
| **Down**: `total < N × repMin` (4 × 8–12 → < 32) in this session **and** the previous one, the second not explained by more pre-fatigue | every set: `stepDown(weight)`; target reps = `repMin` |
| `total < N × repMin` (first time) | same weights; each set keeps **last time's target** (retried, never lowered to what was done) |
| Otherwise, **after a harmonization** (step 1 set a set aside) — *consolidate* | every set at the common weight; target reps = the reps done on the common-weight sets, **no +1** (the set put back to the common weight gets the same target as the others: the lowest of their reps if they differ — see the example) |
| Otherwise | same weights; each set: target reps = reps done + 1, capped at `repMax` |

- The +1 per set capped at `repMax` rebalances reps by itself: strong sets stop at the top while weaker ones catch up, until the total reaches the Up threshold.
- Harmonization doesn't change Up, Down or retry: after a harmonization, Up still moves every set to `stepUp(common weight)` × `repMin`; Down to `stepDown(common weight)` × `repMin`; retry gives every set the common weight with the common sets' last targets.
- **Drop sets / different weights per set** (no lone off-weight set, see step 1): each set keeps its own weight. All sets move together by one step (`stepUp`/`stepDown` applied to each), so the shape is kept (60/57,5/55 → 62,5/60/57,5). The app reproduces what was done; it never proposes drop sets on its own.
- The number of sets is fixed by the exercise (Modifier l'exercice); the exercise screen has no "+ Série". If the set count changes, added sets copy the last set's target and removed sets are dropped from the next targets.
- Changing the rep range: thresholds and targets use the new range from the next session on; weights are kept.
- Exercises skipped in a session don't change their next target.
- An exercise **stopped early** (not every set done) doesn't move it either: next time its targets are retried (never up, never down), and it never counts as one of the two sessions in a row for a drop.
- No 1RM formula: increments must match real plates and machine stacks.
- Pure functions in `shared/` with unit tests for every row, drop sets and first time.

### Available weights (learned, no setting)
- **Known weights** of an exercise = the distinct weights already logged for it (derived from history, no table). Fixing a typo in a past set removes the wrong weight automatically.
- Default step by equipment: barbell 5, dumbbell 2, machine 4.5 (10 lb stacks), cable 2.5 (5 lb stacks), bodyweight 2.5 (added load).
- `stepUp(current, known, step)`: the first known weight above `current` if it is ≤ `current + 2 × step`, else `current + step`. `stepDown` mirrors it (never below 0).
- "+1 step" / "−1 step" in the rules always call `stepUp` / `stepDown` (only used to compute targets; no stepper in the UI).
- The app never needs to know *why* a different weight was typed: whatever was done is recorded, becomes a known weight, and the next targets start from it.
- Example: machine, 8 kg Facile → 12,5 (8 + 4,5). Dumbbells 10 kg Facile → 12; user types 12,5 because 12 doesn't exist; next time from 10 → 12,5 directly.
- Pure functions in `shared/` with tests (no known weight above, known weight too far, typo removed).

### Assistance (bodyweight exercises)
Bodyweight exercises (pull-ups, dips…) can be done with help from an assisted machine. Assistance is stored as a **negative weight**: 20 kg of help = `−20`. Less help is a heavier load, so the progression rules above apply unchanged (Up = less help).
- Only `bodyweight` exercises accept a negative weight (API: −1000 to 1000 in 0.5 steps for them, ≥ 0 for the others → 400). No schema change: `weight` is already a signed decimal.
- Step: from a negative weight, **4.5** (assisted machines are 10 lb stacks), and `stepUp` never goes above 0 (help ends at bodyweight, it never jumps straight to added load). From 0 or more, the bodyweight step (2.5, added load).
- `stepDown` never goes below 0 from 0 or more: the app never proposes help on its own. Help comes back only when the user selects **Aide** in a session; from there, help is lowered as usual.
- Learned weights work as before on the signed values (known −4.5 when stepping up from −9 → −4.5).
- Example: −9 × 12·11·11·10 (total 44) → −4.5 × 8·8·8·8; −4.5 × 12·12·11·10 → 0 × 8·8·8·8 (bodyweight); 0 × 12·12·12·9 → 2.5 × 8·8·8·8.

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
- In a superset, `doneAt` of each set tells which sets of the partner came earlier; partners on independent muscles add 0.
- **Superset context** (asymmetric, same idea): last time done **solo**, this time **in a superset** (shorter rest) and the result is worse → not a failure (weights unchanged, not counted toward the drop); successes count normally. Opened in a superset after a solo session → today's target reps = last reps (no +1). Superset back to solo needs no special case.
- Not displayed: pre-fatigue only feeds the rules above (no battery icon, no "{muscle} déjà travaillé" tag).

### Showing target vs done
- Each set row shows **Objectif** (e.g. "60 × 10", muted) then the two inputs. Inputs are empty with the target as placeholder; ✓ with empty inputs records the target as done, so a set done as planned is one tap.
- Once validated: weight and reps in full colour; reps ≥ target in accent, reps < target in the "over" colour (orange). Tapping ✓ again reopens the row.
- First time: Objectif shows "—" and inputs have no placeholder.

## 4. Screens

### Accueil (mobile `muscu-1-accueil`, desktop `bureau-muscu-accueil`)
- **Prochaine séance** card: workout name, its exercise names (desktop: each with its target), date of the last time, big **Démarrer**.
- **Mes programmes** (where Mes séances was):
  - the **active program** on top: its name with an "Actif" tag (→ its Programme page), then its workouts in rotation order with exercise count and last date, the next one tagged "Suivante" (tap → edit), then a last row **"+ Nouvelle séance" inside the same card** (divider above, dashed "+" badge in the position column, accent text; added to the active program — mockup `muscu-1b-mes-programmes`);
  - the **other programs** below: name and workout count (→ its Programme page) and an **Activer** button (asks "Activer « X » ?" first);
  - "+ Nouveau programme": a sheet asking for the name, then the new program's page.
- **Mes exercices** (mobile: between Prochaine séance and Mes programmes; desktop: right column, Prochaine séance and Mes programmes stacked on the left): each exercise once, by name → its Fiche exercice, in two tabs (segmented control, shown only when the second one has exercises): **Programme actif** (default: the exercises of the active program) and **Autres programmes** (exercises used only in inactive programs). No link to the bank on Accueil (it is reached from Modifier la séance).
- No session history on this page (progress lives in each exercise page).

### Séance — liste (mobile `muscu-2-seance-liste`; desktop: same screen centred, max 560 px)
- Opens on **Démarrer**. Header: close (confirm if sets were logged), workout name, "2 / 5 faits".
- One card per exercise, any order: thumbnail, name, and status only (✓ when done — name muted —, "En cours" outlined, chevron when to do). **No targets and no results in the list**; they appear when the exercise is opened.
- **Terminer la séance** sends the whole session in one call; exercises not done are ignored.
- No pencil / no link to Modifier la séance during a session.
- **Offline** (see "Session without connection" below; mockup `muscu-2b-seance-liste-sans-connexion`): a crossed-cloud icon (`role="img"`, `aria-label="Pas de connexion"`, warning colour) at the right of the header; the close button and **Terminer la séance** are disabled (Terminer keeps its label, with the crossed cloud before it). Everything else works.

### Exercice en cours (mobile `muscu-3-exercice-en-cours`)
- Back arrow → list (progress kept). Image, name, "4 × 8–12" — **not a link** (no Fiche exercice during a session). Identical with or without connection.
- Bodyweight exercises only: a segmented **Lest | Aide** control at the top of the set card (mockups `aide-1-tractions-avec-aide`, `aide-2-aide-a-zero`). No setting on the exercise: the session opens in **Aide** when today's targets are negative, else in **Lest**. In Aide the weight column is titled "Aide kg" and every number (targets, inputs, Dernière fois) is shown and typed **positive**; the app stores the negative value. Switching mode during a session flips the sign of the sets already logged for that exercise. One mode per exercise per session.
- Set rows: Objectif | kg | Reps | ✓ (see 3, "Showing target vs done"). All rows have the same height; weight and reps are typed manually (no − / + buttons). Sets are done **in order**: only the next set has inputs, later ones are locked (their target, read-only); any validated set can be reopened to fix it.
- "Dernière fois · date": sets in the compact format below.
- **Facile**: one optional toggle (outlined button with a bolt icon, `aria-pressed`), off by default. On = "I had a clear margin": the weight goes up next time if the total is at least in the range. No OK / Dur: reps already tell a missed or met target.
- **Terminé** (once every set is done) → back to the list. Not the usual flow: a small "Terminer l'exercice plus tôt" link (after at least one set) asks "Terminer avec 2 / 4 séries ?" first.

### Fiche exercice (mobile `muscu-4-fiche-exercice`, desktop `bureau-muscu-exercice`)
- Name, equipment · workout · sets × rep range (from the exercise), pencil → Modifier l'exercice.
- One image of the exercise with the muscles as pills overlaid at its bottom: primary filled accent, secondary outlined. No muscle map, no next-target block.
- **Progression**: one combined chart per session over the last 12 weeks — bars = volume (Σ weight × reps), line = **average weight weighted by reps** (Σ weight × reps / Σ reps over the done sets, signed for assistance). No summary numbers. Tapping a bar highlights it and shows a small callout above it: date, sets (compact format), volume. Tap elsewhere to hide.
- **Bodyweight exercises** (mockup `aide-3-fiche-tractions`): bars = **total reps** (Σ reps, no weight), legend "Reps", callout "45 reps"; the line is the signed weight (help below, added load above) with a dashed line at 0 labelled "Poids du corps". Desktop history: the volume column becomes "Reps" for them.
- **Historique**: date, sets in the compact format, "Facile" when it was tapped (desktop: table, one column per set + volume + Facile). A session done in a superset gets a small link icon next to the date (`aria-label="En superset"`).

### Programme (`/muscu/programmes/:id`; desktop: same screen centred, max 560 px)
- Séances only (no exercises; they are on Accueil and in Modifier la séance). Header: back, "Programme", delete (inactive programs only; confirm "Supprimer « X » et ses séances ?").
- Name field; Enregistrer appears once it is changed.
- **Activer ce programme** (inactive programs only; asks "Activer « X » ?" first) → back to Accueil, which proposes its first workout.
- **Séances**: its workouts in rotation order ("Actif" tag if it is the active one), tap → Modifier la séance; "+ Nouvelle séance" adds one to this program.

### Modifier la séance (mobile `muscu-5-modifier-seance`)
- Name, ordered exercise list (drag handle), each showing its "sets × min–max" as **muted read-only text** (set in Modifier l'exercice) and a chevron → its Fiche exercice, swipe to remove, "+ Ajouter un exercice" → my exercises in picking mode. Delete workout in the header.
- "Démarrer cette séance" link at the bottom: only in the active program, when no session is in progress.

### Exercices (mobile `muscu-6-exercices`)
- Search (accent/case-insensitive) and the list (thumbnail, name, muscles · equipment). No filters. Opened from a workout (picker in Modifier la séance): "+" adds to it; exercises already in it show the workout name; "+ Créer un exercice" creates a custom exercise and adds it to the workout.

### Compact set format
Consecutive sets at the same weight are grouped: "60 kg × 10 · 9 · 9 · 8". Bodyweight exercises: negative → "Aide 20 kg × 9 · 9 · 8 · 8", 0 → "Poids du corps × 9 · 8 · 8 · 8", positive → "5 kg × …" as usual. A weight change starts a new line (mobile) or group: "57,5 kg × 11 · 10" / "55 kg × 10 · 9". Keeps 4–5 sets readable on a phone.

### Modifier l'exercice (mobile `muscu-7-modifier-exercice`)
- Name; **Séries et répétitions**: three number inputs Séries × Min – Max (defaults 4 × 8–12; API rejects `sets < 1`, `repMin < 1`, `repMin > repMax`); muscles as toggle pills (tap: none → secondary (outlined) → primary (filled) → none), legend Principal / Secondaire; image (change / take photo). Enregistrer. No weight settings (weights are learned).

### Session without connection
The gym has no network. Only **Démarrer**, **Terminer la séance** and **Quitter la séance** (close) need the connection; everything in between runs on the phone.
- **Démarrer** (online): the server creates the session and returns a **session bundle**: the session, and for each exercise everything needed to compute today's targets on the phone — the exercise (name, equipment, muscles, sets, rep range, image), its last and previous logs (sets, pre-fatigue, inSuperset, completed, easy), its known weights and step, plus the superset groups. The images are downloaded once at that moment and kept with the bundle.
- **During the session** (no API call at all): opening an exercise computes its targets with the same `shared/` functions as the server (`preFatigue` from the sets already done in this session, `nextTargets`, superset context, assistance). Validating a set, reopening it, Facile, Lest | Aide, "Terminer l'exercice plus tôt" and Terminé only update the local copy. Each set keeps its `doneAt` (phone clock).
- **Local copy**: one active session only, stored on the device (IndexedDB), written after every change, so closing the tab, a reload, a lock or a restart lose nothing. At Démarrer the app calls `navigator.storage.persist()` (best effort). The Séance screens read the local copy, never the API.
- **Terminer la séance** (online): one request with the whole session (every exercise: sets with targets, weight, reps, done, doneAt; easy; completed; Lest | Aide sign). The server stores it, recomputes pre-fatigue from `doneAt` as today, marks the session finished. The local copy is deleted only after a success. Idempotent: sending the same session again after a lost response returns success, not 409.
- **Quitter la séance** (online): deletes the session on the server, then the local copy.
- **No connection** = `navigator.onLine` is false, or the request fails on the network: the action is refused (button disabled when offline; a failed request shows "Pas de connexion" and keeps everything). Démarrer offline is disabled too.
- Accueil: a session in the local copy shows as the session in progress ("Reprendre"), even offline. Starting on another device while one is in progress is still refused by the server (409).
- Fiche exercice, Modifier la séance and the rest of the app are not reachable from a session; they keep needing the connection as today.

## 5. Supersets

Two exercises of the same workout done alternately, set by set (A1, B1, A2, B2…), usually on independent muscle groups. Planned in the workout, never created during a session.

- Exactly **2 adjacent** items of a workout share a `supersetGroup` (opaque id). Unlinking clears it on both. The API rejects a group of ≠ 2 items or non-adjacent items (400).
- Each exercise keeps its own sets and rep range (from the exercise), e.g. A 4 × 12–15, B 4 × 10–12.
- **Order**: `interleaveSets(a, b)` alternates while both have sets left, then the rest of the longer one (A1 B1 A2 B2 A3 A4). Pure function in `shared/`.
- **Progression** unchanged: each exercise is judged on its own sets; superset context and pre-fatigue as in §3.
- The session snapshots the group on each `SessionExercise`; if the partner is skipped, the exercise counts as solo.

### Modifier la séance (`superset-1-modifier-seance`)
- Between two consecutive exercises that are not in a superset, a small round **link** button (icon only, `aria-label="Relier en superset"`) overlaps the divider.
- A superset is one block: accent vertical bar, "SUPERSET" label, **Délier** (link-off icon + text), then the two rows with badges **A** (accent) and **B** (protein colour), each with its "sets × min–max" as muted read-only text.
- Dragging moves the whole block. No exercise can be inserted inside a superset (unlink first).

### Séance — liste (`superset-2-seance-liste`)
- A superset is **one card**: stacked double thumbnail, "SUPERSET" label, both names with their A/B badges, one status for the pair (to do / En cours / ✓ when both are done). It counts as one item in "x / y faits".

### Superset en cours (`superset-3-superset-en-cours`)
- Header: back to list, "{workout} · Superset". Top: the two exercises side by side (image with badge, name, "sets × range"), not links.
- One set table in interleaved order: badge + set number ("A1", "B1"…), then Objectif | kg | Reps | ✓, same behaviour as Exercice en cours (sets in order, placeholder = target, ✓ on empty records the target, under-target reps in orange).
- "Dernière fois" once per exercise, prefixed by its badge; one **Facile** toggle per exercise (badge + bolt + "Facile"), side by side.
- **Terminé** once every set is done; "Terminer le superset plus tôt" otherwise (same rule as stopping an exercise early, per exercise).

## 6. Build order

1. Module switcher + empty Musculation module and routes.
2. Exercises: schema, Exercices screen, Fiche exercice without chart.
3. Workouts: create/edit, rotation, Accueil.
4. Séance: list, exercise logging with target vs done, resume after reload, Terminer.
5. Progression rules in `shared/` + targets.
6. Combined chart, history, desktop layouts.
7. Programs: group workouts, one active (rotation restarts on activation), Programme page.
8. Supersets: schema, link/unlink, list card, Superset en cours, superset context.
9. Sets and rep range on the exercise.
10. Assistance on bodyweight exercises.
11. Session without connection (see the README of this handoff).

## 7. Acceptance checks

- Tractions 4 × 8–12: aide 32 × 5, then aide 41 × 10 · 10 · 10 → harmonized, judged on 41 × 10 · 10 · 10 (total 30 over 3 sets: not Up ≥ 33, not < 24) → consolidate → **aide 41 × 10 · 10 · 10 · 10**.
- 60 × 10 · 10 · 10 then a last set at 50 × 12 → **60 × 10 · 10 · 10 · 10**.
- 60 × 8 then 50 × 12 · 12 · 12 (barbell) → judged on 50 × 12 · 12 · 12 (36 ≥ 33) → Up → **55 × 8 · 8 · 8 · 8**.
- 60 × 10 · 9 · 9 then 70 × 4 → consolidate at 60 with targets 10 · 9 · 9 and 9 for the harmonized set → **60 × 10 · 9 · 9 · 9**.
- Drop sets 60 / 57,5 / 55 or 60 · 60 · 50 · 50 → not harmonized, shape kept as before.
- Chart line for 32 × 5 + 41 × 10 · 10 · 10 (aide) = −(5 × 32 + 30 × 41) / 35 ≈ −39,7.

- Démarrer online, then airplane mode: every exercise opens with its targets and image, sets are validated, Facile and Terminé work, the list shows ✓; a reload keeps everything.
- Opening Développé couché after 3 sets of Dips offline gives the same targets as the server would (pre-fatigue computed on the phone).
- Offline, Terminer la séance and the close button are disabled and the crossed cloud shows; back online, Terminer sends the session once and the history shows it with the right doneAt order.
- Terminer sent twice (lost response) → one session, no 409.
- No link to the Fiche exercice or to Modifier la séance anywhere in a session.

- After finishing Push A, Accueil proposes Pull; after Push B, it proposes Push A.
- Exercises can be done in any order from the list; skipped ones keep their target.
- 4 × 8–12, 50 kg, done 12·12·12·8 (total 44) → next time one step up, targets × 8·8·8·8.
- Done 11·11·11·10 (total 43) → 50 × 12·12·12·11; done as targeted (total 47) → step up the time after.
- Done 12·12·12·7 (total 43) → 50 × 12·12·12·8; never counts toward a drop.
- Target 50 × 10·10·10·10, done 10·10·10·8 → 50 × 11·11·11·9.
- Done 7·7·6·6 (total 26, < 32) the first time → targets retried: 50 × last targets.
- Reps rebalance: 10·10·10·8 → 11·11·11·9 → 12·12·12·10 (total 46) → next weight (Facile never tapped, targets met).
- 57,5 × 12·12·11·10 (total 45) → 60 × 8·8·8·8, with or without Facile.
- Done 9·9·8·7 (total 33, ≥ 32) "Facile" → step up.
- Done 7·7·6·6 (total 26) twice in a row, same pre-fatigue → every weight one step down, targets × 8; the second time with more pre-fatigue → no drop.
- Dumbbells 10 kg "Facile", user logs 12,5 → next time a step up from 10 kg gives 12,5.
- Known weights {8, 30}: stepping up from 8 (machine) gives 12,5, not 30.
- Barbell 60 kg × 12·12·12·8, no known weight above → 65 × 8·8·8·8.
- Drop set 60×12 · 57,5×12 · 55×12 → 62,5 · 60 · 57,5.
- ✓ on an empty row records the target; a set done under target shows its reps in orange.
- Reloading the page in the middle of a session keeps every validated set.
- Existing workouts end up in one active program, "Mon programme", and the next workout doesn't change.
- Activating program B proposes B's first workout; after finishing it, B's second. Re-activating A proposes A's first workout, whatever was done last in A.
- Mes exercices shows the active program's exercises; the "Autres programmes" tab shows those only in inactive programs. The Programme page lists no exercises.
- Every exercise row of Modifier la séance opens its Fiche exercice.
- A workout of an inactive program has no "Démarrer cette séance" link, and starting it through the API is refused (400).
- The active program can't be deleted (409); deleting another one removes its workouts.
- Linking two 4-set exercises gives A1 B1 A2 B2 A3 B3 A4 B4; 4 + 3 sets → A1 B1 A2 B2 A3 B3 A4.
- Unlinking keeps both exercises, their targets and their order; the API rejects a group of 3 items or two non-adjacent items.
- The list shows one card for a superset; it gets ✓ only when both exercises are done.
- Exercise done solo last time at 25 kg × 11·10·10·9: in a superset today its targets are 25 × 11·10·10·9; done 10·9·9·8 → weight stays 25 kg, no drop strike.
- The same exercise in two workouts shows the same "sets × range" in both.
- Changing Rowing from 4 × 8–12 to 3 × 8–12: the next session has 3 sets; past sessions still show 4 sets in history and chart volume.
- Changing a range to 6–10 with 3 sets: Up threshold 27 reps, Down threshold 18; weights unchanged.
- Tractions, Aide 20 × 9·9·8·8 (total 34) → targets Aide 20 × 10·10·9·9; inputs show 20, the API stores −20.
- Aide 4,5 × 12·12·11·10 → next session opens in Lest with targets 0 × 8·8·8·8; from 0 × 7·7·6·6 twice → stays 0 (no help proposed).
- Selecting Aide mid-session on a set logged 10 → stored −10. Sending −10 for a barbell exercise → 400.
- Chart of a bodyweight exercise: bars = total reps; a 0 kg session isn't a zero bar.
- Food pages are unchanged except the switcher in the top bar.
