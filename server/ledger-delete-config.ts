/**
 * After a month is closed, entry/penalty rows for that accounting month can be removed from the
 * live collections — totals remain in MonthlyHistory. Default: enabled.
 * Set DELETE_LEDGER_ROWS_AFTER_MONTH_CLOSE=false to keep archived rows in Mongo (larger DB).
 */
export function isDeleteLedgerRowsAfterMonthCloseEnabled(): boolean {
  const raw = process.env.DELETE_LEDGER_ROWS_AFTER_MONTH_CLOSE;
  if (raw === undefined || String(raw).trim() === "") return true;
  const v = String(raw).trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}
