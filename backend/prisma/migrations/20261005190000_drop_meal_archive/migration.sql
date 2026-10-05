-- Archiving is gone: meals are deleted for good (log entries keep their snapshot).
-- Previously archived meals simply show up again in Mes repas.
ALTER TABLE "Meal" DROP COLUMN "archived";
