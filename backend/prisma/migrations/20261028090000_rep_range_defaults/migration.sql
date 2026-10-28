-- Exercise defaults 4 × 7–10 (existing exercises are migrated by hand, past sessions keep their snapshot).

-- AlterTable
ALTER TABLE "Exercise" ALTER COLUMN "repMin" SET DEFAULT 7,
ALTER COLUMN "repMax" SET DEFAULT 10;
