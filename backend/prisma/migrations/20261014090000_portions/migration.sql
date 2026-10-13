-- A food has one optional portion (its weight in grams) instead of free-label units,
-- and a meal item entered in portions keeps their count. Grams stay the source of truth.

-- AlterTable
ALTER TABLE "Food" ADD COLUMN "portionGrams" DECIMAL(7,1);

-- AlterTable
ALTER TABLE "MealItem" ADD COLUMN "portions" DECIMAL(5,2);

-- The first unit of a food becomes its portion, whatever its label (c. à s., pièce, portion…).
UPDATE "Food"
SET "portionGrams" = ROUND(("units"->0->>'grams')::numeric, 1)
WHERE jsonb_typeof("units") = 'array'
  AND jsonb_typeof("units"->0->'grams') = 'number'
  AND ROUND(("units"->0->>'grams')::numeric, 1) BETWEEN 0.1 AND 2000;

-- Items entered with a unit are counted in portions of their food; the others stay in grams.
UPDATE "MealItem" AS i
SET "portions" = ROUND(i."grams" / f."portionGrams", 2)
FROM "Food" AS f
WHERE f."id" = i."foodId"
  AND i."unitLabel" IS NOT NULL
  AND f."portionGrams" IS NOT NULL
  AND ROUND(i."grams" / f."portionGrams", 2) BETWEEN 0.01 AND 999.99;

-- AlterTable
ALTER TABLE "Food" DROP COLUMN "units";

-- AlterTable
ALTER TABLE "MealItem" DROP COLUMN "unitLabel",
DROP COLUMN "unitCount";
