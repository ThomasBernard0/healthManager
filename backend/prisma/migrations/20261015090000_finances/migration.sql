-- Finances: the lines of a typical month (incomes and expenses, monthly, in cents).

-- CreateEnum
CREATE TYPE "FinanceKind" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "FinanceCategory" AS ENUM ('housing', 'subscriptions', 'savings', 'other');

-- CreateTable
CREATE TABLE "FinanceLine" (
    "id" TEXT NOT NULL,
    "kind" "FinanceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" "FinanceCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLine_pkey" PRIMARY KEY ("id")
);

-- Not modelled by Prisma: an expense has a category, an income has none; amounts are positive.
ALTER TABLE "FinanceLine" ADD CONSTRAINT "FinanceLine_category_check"
    CHECK (("kind" = 'income' AND "category" IS NULL) OR ("kind" = 'expense' AND "category" IS NOT NULL));
ALTER TABLE "FinanceLine" ADD CONSTRAINT "FinanceLine_amountCents_check" CHECK ("amountCents" > 0);
