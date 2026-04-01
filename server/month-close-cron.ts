import { storage } from "./storage";
import { previousCalendarMonthKey, parseAccountingMonthKey } from "./lib/accounting-month";
import { isAutoClosePreviousAccountingMonthEnabled } from "./auto-close-config";
import { snapshotCloseAndPurgeAccountingMonth } from "./ledger-month-rollover";

/**
 * Milliseconds until the next occurrence of `hour`:`minute` in the server's **local** timezone.
 * If that time has passed today, schedules tomorrow (calendar-day aligned — no 24h drift).
 */
export function msUntilNextLocalWallTime(targetHour: number, targetMinute: number): number {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    targetHour,
    targetMinute,
    0,
    0,
  );
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function parseRunClock(): { hour: number; minute: number } {
  const h = Number.parseInt(String(process.env.ACCOUNTING_MONTH_CLOSE_RUN_HOUR ?? "0"), 10);
  const hour = Number.isFinite(h) && h >= 0 && h <= 23 ? h : 0;
  const m = Number.parseInt(String(process.env.ACCOUNTING_MONTH_CLOSE_RUN_MINUTE ?? "5"), 10);
  const minute = Number.isFinite(m) && m >= 0 && m <= 59 ? m : 5;
  return { hour, minute };
}

/** Exported for tests / manual trigger; closes previous calendar month for every flat if still open. */
export async function runPreviousAccountingMonthCloseForAllFlats(): Promise<void> {
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
          console.log(`🔒 Accounting month close ${key} for flat ${fid}:`, stats, purge);
        }
      } catch (e) {
        console.error(`❌ Month-close failed for flat ${fid} ${key}:`, e);
      }
    }
  } catch (e) {
    console.error("❌ Month-close batch failed:", e);
  }
}

/**
 * Automatic month-end handling (no manual UI):
 * - `index.ts` calls `runPreviousAccountingMonthCloseForAllFlats()` once after DB connect.
 * - This schedules the same job every local calendar day at
 *   ACCOUNTING_MONTH_CLOSE_RUN_HOUR:MINUTE (default 00:05) — no drifting 24h interval.
 *
 * Uses server OS local timezone. Disabled when AUTO_CLOSE_PREVIOUS_ACCOUNTING_MONTH=false.
 */
export function startAccountingMonthCloseCron(): void {
  if (!isAutoClosePreviousAccountingMonthEnabled()) {
    console.log("📅 Accounting month auto-close: disabled (AUTO_CLOSE_PREVIOUS_ACCOUNTING_MONTH)");
    return;
  }

  const { hour, minute } = parseRunClock();

  const scheduleLoop = (): void => {
    const delay = msUntilNextLocalWallTime(hour, minute);
    setTimeout(async () => {
      await runPreviousAccountingMonthCloseForAllFlats();
      scheduleLoop();
    }, delay);
  };

  scheduleLoop();

  console.log(
    `📅 Accounting month auto-close: daily at local ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} (server TZ) + startup pass in index.ts`,
  );
}
