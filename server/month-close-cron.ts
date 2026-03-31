import { storage } from "./storage";
import { previousCalendarMonthKey, parseAccountingMonthKey } from "./lib/accounting-month";
import { isAutoClosePreviousAccountingMonthEnabled } from "./auto-close-config";
import { snapshotCloseAndPurgeAccountingMonth } from "./ledger-month-rollover";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily safety net: close the previous calendar month if it is still open.
 * Disabled when AUTO_CLOSE_PREVIOUS_ACCOUNTING_MONTH=false.
 */
export function startAccountingMonthCloseCron(): NodeJS.Timeout | null {
  if (!isAutoClosePreviousAccountingMonthEnabled()) {
    console.log("📅 Accounting month auto-close cron: disabled (AUTO_CLOSE_PREVIOUS_ACCOUNTING_MONTH)");
    return null;
  }

  const tick = async () => {
    const key = previousCalendarMonthKey();
    if (!parseAccountingMonthKey(key)) return;
    try {
      const flats = await storage.getAllFlats();
      for (const flat of flats) {
        const fid = String(flat._id);
        try {
          const locked = await storage.isAccountingMonthLocked(fid, key);
          if (locked) continue;
          const { stats, purge } = await snapshotCloseAndPurgeAccountingMonth(fid, key);
          if (
            !stats.alreadyClosed ||
            (purge && (purge.entries > 0 || purge.penalties > 0)) ||
            stats.entries + stats.payments + stats.bills + stats.penalties > 0
          ) {
            console.log(`🔒 Daily rollover ${key} for flat ${fid}:`, stats, purge);
          }
        } catch (e) {
          console.error(`❌ Daily month-close failed for flat ${fid} ${key}:`, e);
        }
      }
    } catch (e) {
      console.error("❌ Daily month-close cron tick failed:", e);
    }
  };

  void tick();
  return setInterval(() => {
    void tick();
  }, DAY_MS);
}
