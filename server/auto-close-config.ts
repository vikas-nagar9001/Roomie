/**
 * When unset, defaults to true so existing deployments keep rollover auto-close behaviour.
 * Set AUTO_CLOSE_PREVIOUS_ACCOUNTING_MONTH=false (or 0, off, no) to disable:
 * - penalty-checker month-rollover close
 * - daily safety-net close job
 */
export function isAutoClosePreviousAccountingMonthEnabled(): boolean {
  const raw = process.env.AUTO_CLOSE_PREVIOUS_ACCOUNTING_MONTH;
  if (raw === undefined || String(raw).trim() === "") return true;
  const v = String(raw).trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}
