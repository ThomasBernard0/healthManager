-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- One active program holding every existing workout. Activated at the epoch, so the current rotation goes on.
INSERT INTO "Program" ("id", "name", "position", "active", "activatedAt", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Mon programme', 1, true, '1970-01-01T00:00:00Z', CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "programId" TEXT;
UPDATE "Workout" SET "programId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Workout" ALTER COLUMN "programId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Workout_programId_idx" ON "Workout"("programId");

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
