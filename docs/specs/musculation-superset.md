# Musculation — Supersets (addendum)

Extends `docs/specs/musculation.md`. Everything not mentioned here stays as specified there (French UI, theme tokens, no helper text, progression rules, learned weights, pre-fatigue).

Mockups: `design/musculation/superset-1-modifier-seance.html`, `superset-2-seance-liste.html`, `superset-3-superset-en-cours.html` (dark theme).

## 1. What a superset is

Two exercises of the same workout done alternately, set by set (A1, B1, A2, B2…), usually on independent muscle groups. Supersets are **planned in the workout**; they are not created during a session.

- A superset groups exactly **2** consecutive exercises of a workout.
- Each exercise keeps its own sets and rep range (e.g. A 4 × 12–15, B 4 × 10–12).
- If the set counts differ, sets alternate while both have sets left, then the remaining sets of the longer one follow (A1 B1 A2 B2 A3 A4).

## 2. Data model changes

```ts
// Workout item gets an optional group id; two items with the same group form a superset.
Workout { id, name, position,
          items: { exerciseId, sets, repMin, repMax, order, group? }[] }

// Each logged set keeps when it was validated (gives the real order A1, B1, A2…).
SessionExercise { …, inSuperset: boolean,
                  sets: { targetWeight?, targetReps?, weight, reps, done, doneAt? }[] }
```

- `group`: shared opaque id (e.g. uuid) on the two items; items of a group must be adjacent in `order`. Unlinking removes `group` from both.
- `inSuperset` is copied from the workout when the session starts, so history stays correct if the workout changes later.
- Validation: a group with ≠ 2 items, or non-adjacent items, is rejected by the API (400).

## 3. Algorithm

- **Progression unchanged**: each exercise is judged on its own sets with the same thresholds, `stepUp`/`stepDown` and targets as in the main spec. A superset is only a way of ordering sets.
- **Pre-fatigue**: computed per exercise exactly as before, using `doneAt` to know which sets of the partner came earlier. Partners on independent muscles add 0. A partner sharing only a secondary muscle counts ½ per earlier set.
- **Superset context** (asymmetric, like pre-fatigue): if the last time the exercise was done **solo** and this time **in a superset** (shorter rest) and the result is worse, it is not a failure. Weights stay the same, and the session does not count toward the two-sessions-in-a-row drop. Successes count normally. As with pre-fatigue, when an exercise last done solo is opened in a superset, today's target reps = last reps (no +1). Going from superset back to solo needs no special case.
- Pure functions in `shared/` (`interleaveSets(a, b)`, context comparison) with unit tests.

## 4. Screens

### Modifier la séance (`superset-1-modifier-seance`)
- Between two consecutive exercises that are not in a superset, a small round **link** button (icon only, `aria-label="Relier en superset"`) overlaps the divider. Tapping it groups the two.
- A superset is shown as one block: accent vertical bar on the left, "SUPERSET" label, **Délier** button (link-off icon + text), then the two rows with letter badges **A** (accent `#5DBB8C`) and **B** (protein blue `#82AAD6`), each with its own "sets × min–max" chip.
- Dragging moves the whole block. Adding an exercise inside a superset is not possible (unlink first).
- When linking two exercises that share a **primary** muscle, show the battery icon on the block (`aria-label="Mêmes muscles"`). No blocking.

### Séance — liste (`superset-2-seance-liste`)
- A superset is **one card**: stacked double thumbnail, "SUPERSET" label, both names with their A/B badges, one status for the pair (to do / En cours / ✓ when both exercises are done).
- The progress counter counts the superset as one item ("2 / 4 faits" for 3 exercises + 1 superset).
- A pencil in the header opens Modifier la séance (changes apply to future sessions, not to the current one).

### Superset en cours (`superset-3-superset-en-cours`)
- Header: back to list, "{workout} · Superset".
- Top: the two exercises side by side (image with A/B badge, name, "sets × range"); tap → its exercise page.
- One set table in interleaved order: first column = badge + set number ("A1", "B1", "A2"…), then Objectif | kg | Reps | ✓, same behaviour as the single-exercise screen (placeholder = target, ✓ on empty records the target, under-target reps in orange). The next row to do is the one with active inputs; rows can still be filled in any order.
- "Dernière fois" twice, one line per exercise with its badge, compact set format.
- **Ressenti**: one Facile / OK / Dur row per exercise, each prefixed by its badge.
- **Terminé** → back to the list.

### History and exercise page
- History rows of a set done in a superset get a small link icon (`aria-label="En superset"`) next to the date. Nothing else changes.

## 5. Build order

1. Schema (`group`, `inSuperset`, `doneAt`) + API validation + `interleaveSets` in `shared/`.
2. Modifier la séance: link / unlink, block drag.
3. Session list card + Superset en cours screen.
4. Superset context in the progression rules + history icon.

## 6. Acceptance checks

- Linking Élévations latérales (4 sets) and Extension triceps (4 sets) gives the order A1 B1 A2 B2 A3 B3 A4 B4.
- A with 4 sets, B with 3 sets → A1 B1 A2 B2 A3 B3 A4.
- Unlinking keeps both exercises, their targets and their order.
- The list shows one card for the pair; it gets ✓ only when both exercises are done.
- Exercise done solo last time at 25 kg × 11·10·10·9: in a superset today its targets are 25 × 11·10·10·9 (no +1); done 10·9·9·8 → weight stays 25 kg and the session does not count toward a drop.
- Partner on independent muscles → pre-fatigue 0; partner sharing a secondary muscle with 2 earlier sets → 1.
- API rejects a group of 3 items or two non-adjacent items.
