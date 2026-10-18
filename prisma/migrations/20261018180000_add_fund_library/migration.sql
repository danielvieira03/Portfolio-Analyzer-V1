-- CreateTable
CREATE TABLE "FundInfo" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "durationYears" REAL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "seeded" BOOLEAN NOT NULL DEFAULT false,
    "pricesUpdatedAt" DATETIME,
    "fundsSeeded" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_AppState" ("id", "isDemoData", "pricesUpdatedAt", "seeded") SELECT "id", "isDemoData", "pricesUpdatedAt", "seeded" FROM "AppState";
DROP TABLE "AppState";
ALTER TABLE "new_AppState" RENAME TO "AppState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
