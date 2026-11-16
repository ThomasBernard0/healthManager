-- A food logged on its own (Ajout rapide): LogKind food, its food and, when logged in grams, the grams.

-- AlterEnum
ALTER TYPE "LogKind" ADD VALUE 'food';

-- AlterTable
ALTER TABLE "LogEntry" ADD COLUMN     "foodId" TEXT,
ADD COLUMN     "grams" DECIMAL(7,1);

-- CreateIndex
CREATE INDEX "LogEntry_foodId_idx" ON "LogEntry"("foodId");

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

