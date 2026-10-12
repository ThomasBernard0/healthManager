-- Only "Facile": the Facile / OK / Dur feeling becomes one flag.

-- AlterTable
ALTER TABLE "SessionExercise" ADD COLUMN "easy" BOOLEAN NOT NULL DEFAULT false;

-- "Facile" stays tapped; OK, Dur and no feeling are false.
UPDATE "SessionExercise" SET "easy" = true WHERE "feeling" = 'easy';

-- AlterTable
ALTER TABLE "SessionExercise" DROP COLUMN "feeling";

-- DropEnum
DROP TYPE "Feeling";
