-- Migration 0009: Add qty_after_transaction to stock_movements.
--
-- Records the stock level after each movement is applied.
-- Enables historical stock reconstruction ("what was the stock on March 15?")
-- without scanning the entire movements table.
-- Pattern inspired by ERPNext's Stock Ledger Entry.qty_after_transaction.
--
-- Nullable because existing rows don't have this value.
-- New movements will always populate it.

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "qty_after_transaction" integer;
