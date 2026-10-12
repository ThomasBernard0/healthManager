-- Nothing reads where a food came from since the CIQUAL bank is gone.
-- AlterTable
ALTER TABLE "Food" DROP COLUMN "source";

-- DropEnum
DROP TYPE "FoodSource";
