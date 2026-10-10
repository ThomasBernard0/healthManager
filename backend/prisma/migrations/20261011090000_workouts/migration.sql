-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutItem" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 4,
    "repMin" INTEGER NOT NULL DEFAULT 8,
    "repMax" INTEGER NOT NULL DEFAULT 12,
    "position" INTEGER NOT NULL,

    CONSTRAINT "WorkoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutItem_exerciseId_idx" ON "WorkoutItem"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutItem_workoutId_exerciseId_key" ON "WorkoutItem"("workoutId", "exerciseId");

-- AddForeignKey
ALTER TABLE "WorkoutItem" ADD CONSTRAINT "WorkoutItem_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutItem" ADD CONSTRAINT "WorkoutItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

