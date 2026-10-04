-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('custom', 'ciqual', 'off');

-- CreateEnum
CREATE TYPE "MealMode" AS ENUM ('ingredients', 'manual');

-- CreateEnum
CREATE TYPE "LogKind" AS ENUM ('meal', 'quick');

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "brand" TEXT,
    "source" "FoodSource" NOT NULL,
    "ciqualCode" TEXT,
    "barcode" TEXT,
    "kcal" INTEGER NOT NULL,
    "protein" DECIMAL(7,1) NOT NULL,
    "carbs" DECIMAL(7,1) NOT NULL,
    "fat" DECIMAL(7,1) NOT NULL,
    "units" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "mode" "MealMode" NOT NULL,
    "manualKcal" INTEGER,
    "manualProtein" DECIMAL(7,1),
    "manualCarbs" DECIMAL(7,1),
    "manualFat" DECIMAL(7,1),
    "overrideKcal" INTEGER,
    "overrideProtein" DECIMAL(7,1),
    "overrideCarbs" DECIMAL(7,1),
    "overrideFat" DECIMAL(7,1),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "grams" DECIMAL(7,1) NOT NULL,
    "unitLabel" TEXT,
    "unitCount" DECIMAL(5,2),
    "position" INTEGER NOT NULL,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "kind" "LogKind" NOT NULL,
    "mealId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(5,2) NOT NULL,
    "kcal" INTEGER NOT NULL,
    "protein" DECIMAL(7,1) NOT NULL,
    "carbs" DECIMAL(7,1) NOT NULL,
    "fat" DECIMAL(7,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "dailyKcal" INTEGER NOT NULL,
    "protein" DECIMAL(6,1) NOT NULL,
    "carbs" DECIMAL(6,1) NOT NULL,
    "fat" DECIMAL(6,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Food_ciqualCode_key" ON "Food"("ciqualCode");

-- CreateIndex
CREATE UNIQUE INDEX "Food_barcode_key" ON "Food"("barcode");

-- CreateIndex
CREATE INDEX "Food_searchName_idx" ON "Food"("searchName");

-- CreateIndex
CREATE INDEX "MealItem_mealId_idx" ON "MealItem"("mealId");

-- CreateIndex
CREATE INDEX "MealItem_foodId_idx" ON "MealItem"("foodId");

-- CreateIndex
CREATE INDEX "LogEntry_date_idx" ON "LogEntry"("date");

-- CreateIndex
CREATE INDEX "LogEntry_mealId_idx" ON "LogEntry"("mealId");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_validFrom_key" ON "Goal"("validFrom");

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
