-- The CIQUAL food bank is gone: only my own foods and scanned products remain.
-- Meals built with a CIQUAL ingredient are deleted (log entries keep their snapshot).
DELETE FROM "Meal" WHERE "id" IN (
  SELECT mi."mealId" FROM "MealItem" mi JOIN "Food" f ON f."id" = mi."foodId" WHERE f."source" = 'ciqual'
);
DELETE FROM "Food" WHERE "source" = 'ciqual';

-- DropIndex
DROP INDEX "Food_ciqualCode_key";

-- AlterTable
ALTER TABLE "Food" DROP COLUMN "ciqualCode";

-- AlterEnum
ALTER TYPE "FoodSource" RENAME TO "FoodSource_old";
CREATE TYPE "FoodSource" AS ENUM ('custom', 'off');
ALTER TABLE "Food" ALTER COLUMN "source" TYPE "FoodSource" USING ("source"::text::"FoodSource");
DROP TYPE "FoodSource_old";
