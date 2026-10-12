# Alimentation — Goal: calories drive the macros (addendum)

Extends `docs/specs/caloriesTracker.md` (screen "Mon objectif"). Mockup: `design/mobile-5-mon-objectif.html` (replaces the previous version; same tokens, dark theme applies as usual).

## Problem
Today the daily goal stores kcal, protein, carbs and fat independently, so they can contradict each other (e.g. 2 800 kcal with 150 g P / 230 g C / 70 g F = 2 150 kcal).

## Rule
- The user sets **kcal**, **protein (g)** and **fat (g)**. **Carbs are derived**:
  `carbs = round((kcal − 4 × protein − 9 × fat) / 4)`
- Atwater factors: protein 4, carbs 4, fat 9 kcal/g. Put them and the function in `shared/` (`deriveCarbs(kcal, protein, fat)`), with tests.
- If `kcal − 4P − 9F < 0`, the goal is invalid: carbs value shown in the "over" colour, **Enregistrer** disabled. The API also rejects it (400).
- The stored goal keeps all four numbers (carbs = the derived value at save time), so history and the existing week maths don't change.
- Migration: existing goals keep their kcal, protein and fat; carbs are recomputed with the rule.

## Screen "Mon objectif"
- Calories: stepper ±50 (unchanged).
- Under it, a thin stacked bar showing the kcal split: protein (protein colour), fat (fat colour), carbs (carbs colour, last like its row), proportional to 4P / 9F / 4C over kcal. Decorative (`aria-hidden`).
- Rows: Protéines (input), Lipides (input), Glucides (read-only value on a ground-coloured box, `aria-label="Glucides par jour, calculés"`). Each row has its macro colour dot. Carbs update live while typing.
- No helper text.

## Not changed
Meals, foods and log entries keep the kcal entered or read from labels / databases; they are **never** recomputed from macros (fibre, alcohol, polyols and rounding make labels differ from 4/4/9). Small gaps between logged kcal and logged macros are expected.

## Acceptance checks
- 2 400 kcal, P 160, F 80 → carbs 260.
- 2 800 kcal, P 150, F 70 → carbs 393 (392.5 rounded).
- Raising kcal by 50 raises carbs by 12–13 g; changing P by +10 g lowers carbs by 10 g; F +10 g lowers carbs by 23 g (22.5 rounded).
- 1 500 kcal, P 200, F 100 → invalid (−200 kcal left), save disabled, API 400.
- A meal logged as 500 kcal with P 30 / C 50 / F 15 (= 455 by 4/4/9) still counts 500 kcal.
