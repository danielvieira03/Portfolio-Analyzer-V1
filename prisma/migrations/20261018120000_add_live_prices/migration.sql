-- AlterTable
ALTER TABLE "AppState" ADD COLUMN "pricesUpdatedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "sector" TEXT,
    "subtype" TEXT,
    "shares" REAL NOT NULL,
    "costBasisPerShare" REAL NOT NULL,
    "currentPrice" REAL NOT NULL,
    "noLivePrice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Holding" ("assetClass", "costBasisPerShare", "createdAt", "currentPrice", "id", "name", "sector", "shares", "subtype", "ticker", "updatedAt") SELECT "assetClass", "costBasisPerShare", "createdAt", "currentPrice", "id", "name", "sector", "shares", "subtype", "ticker", "updatedAt" FROM "Holding";
DROP TABLE "Holding";
ALTER TABLE "new_Holding" RENAME TO "Holding";
CREATE UNIQUE INDEX "Holding_assetClass_ticker_key" ON "Holding"("assetClass", "ticker");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
