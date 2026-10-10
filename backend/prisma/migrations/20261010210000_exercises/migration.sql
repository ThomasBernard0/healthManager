-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight');

-- CreateEnum
CREATE TYPE "Muscle" AS ENUM ('chest', 'back', 'shoulders_front', 'shoulders_side', 'shoulders_rear', 'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves');

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "equipment" "Equipment" NOT NULL,
    "primaryMuscles" "Muscle"[],
    "secondaryMuscles" "Muscle"[],
    "bankKey" TEXT,
    "image" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_bankKey_key" ON "Exercise"("bankKey");

-- CreateIndex
CREATE INDEX "Exercise_searchName_idx" ON "Exercise"("searchName");

