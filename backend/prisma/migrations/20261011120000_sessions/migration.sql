-- CreateEnum
CREATE TYPE "Feeling" AS ENUM ('easy', 'ok', 'hard');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT,
    "workoutName" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "repMin" INTEGER NOT NULL,
    "repMax" INTEGER NOT NULL,
    "firstSetAt" TIMESTAMPTZ,
    "preFatigue" DECIMAL(4,1),
    "feeling" "Feeling",
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionSet" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "targetWeight" DECIMAL(6,1),
    "targetReps" INTEGER,
    "weight" DECIMAL(6,1),
    "reps" INTEGER,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMPTZ,

    CONSTRAINT "SessionSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_finishedAt_idx" ON "Session"("finishedAt");

-- CreateIndex
CREATE INDEX "SessionExercise_exerciseId_idx" ON "SessionExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionExercise_sessionId_exerciseId_key" ON "SessionExercise"("sessionId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionSet_sessionExerciseId_index_key" ON "SessionSet"("sessionExerciseId", "index");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSet" ADD CONSTRAINT "SessionSet_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

