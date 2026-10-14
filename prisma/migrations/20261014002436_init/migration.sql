-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "sector" TEXT,
    "shares" REAL NOT NULL,
    "costBasisPerShare" REAL NOT NULL,
    "currentPrice" REAL NOT NULL,
    "priceAsOf" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CashBalance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "amount" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "seeded" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "Holding_assetClass_ticker_key" ON "Holding"("assetClass", "ticker");
