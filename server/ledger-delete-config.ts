/**
 * After a month is closed, entry/penalty rows may optionally be hard-deleted for that accounting month.
 * Ledger architecture keeps archived rows as source of truth — default is to NOT delete.
 * Set DELETE_LEDGER_ROWS_AFTER_MONTH_CLOSE=true to remove rows after close (legacy / smaller DB).
 */
export function isDeleteLedgerRowsAfterMonthCloseEnabled(): boolean {
  const raw = process.env.DELETE_LEDGER_ROWS_AFTER_MONTH_CLOSE;
  if (raw === undefined || String(raw).trim() === "") return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}
