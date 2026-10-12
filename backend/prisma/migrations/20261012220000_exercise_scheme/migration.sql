-- Sets and rep range move from the workout item to the exercise.

-- AlterTable
ALTER TABLE "Exercise"
  ADD COLUMN "sets" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "repMin" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "repMax" INTEGER NOT NULL DEFAULT 12;

-- Exercises whose workouts disagreed (Postgres log).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT e."name",
           string_agg(w."name" || ' ' || i."sets" || ' × ' || i."repMin" || '–' || i."repMax", ', ' ORDER BY w."createdAt") AS schemes
    FROM "WorkoutItem" i
    JOIN "Exercise" e ON e."id" = i."exerciseId"
    JOIN "Workout" w ON w."id" = i."workoutId"
    GROUP BY e."id", e."name"
    HAVING COUNT(DISTINCT (i."sets", i."repMin", i."repMax")) > 1
  LOOP
    RAISE WARNING 'exercise_scheme: "%" had several schemes (%)', r."name", r.schemes;
  END LOOP;
END $$;

-- The scheme of the workout used most recently (latest finished session), else of the oldest workout.
-- Exercises in no workout keep 4 × 8–12.
UPDATE "Exercise" e
SET "sets" = s."sets", "repMin" = s."repMin", "repMax" = s."repMax"
FROM (
  SELECT DISTINCT ON (i."exerciseId") i."exerciseId", i."sets", i."repMin", i."repMax"
  FROM "WorkoutItem" i
  JOIN "Workout" w ON w."id" = i."workoutId"
  LEFT JOIN (
    SELECT "workoutId", MAX("finishedAt") AS "lastUsed"
    FROM "Session"
    WHERE "finishedAt" IS NOT NULL
    GROUP BY "workoutId"
  ) u ON u."workoutId" = w."id"
  ORDER BY i."exerciseId", u."lastUsed" DESC NULLS LAST, w."createdAt" ASC, w."id" ASC
) s
WHERE s."exerciseId" = e."id";

-- AlterTable
ALTER TABLE "WorkoutItem" DROP COLUMN "sets", DROP COLUMN "repMin", DROP COLUMN "repMax";
