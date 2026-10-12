-- Goal carbs are now derived from kcal, protein and fat (docs/specs/goal-macros.md):
--   carbs = round((kcal − 4 × protein − 9 × fat) / 4)
-- Existing goals keep their kcal, protein and fat; only carbs is recomputed, for every version.
-- numeric ROUND rounds halves away from zero (392.5 → 393), like deriveCarbs in shared/.
-- A goal whose protein and fat already exceed its kcal gets 0 g (carbs can't be negative);
-- it shows as invalid in "Mon objectif" until it is corrected.
UPDATE "Goal"
SET "carbs" = GREATEST(ROUND(("dailyKcal" - 4 * "protein" - 9 * "fat") / 4), 0);
