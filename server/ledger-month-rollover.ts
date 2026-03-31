import { storage } from "./storage";
import { snapshotMonthForFlat } from "./snapshot-month";
import { parseAccountingMonthKey } from "./lib/accounting-month";
import { isDeleteLedgerRowsAfterMonthCloseEnabled } from "./ledger-delete-config";

/**
 * 1) Upsert MonthlyHistory snapshot for the month
 * 2) Lock + archive ledger rows (FlatMonth + lifecycle on entries/penalties/bills/payments)
 * 3) Optionally delete entry + penalty documents for that accounting month (History uses MonthlyHistory)
 */
export async function snapshotCloseAndPurgeAccountingMonth(
  flatId: string,
  monthKey: string,
  closedByUserId?: string,
): Promise<{
  stats: Awaited<ReturnType<typeof storage.closeFlatMonth>>;
  purge: { entries: number; penalties: number } | null;
}> {
  const parsed = parseAccountingMonthKey(monthKey);
  if (!parsed) throw new Error(`Invalid monthKey: ${monthKey}`);
  await snapshotMonthForFlat(flatId, parsed.year, parsed.monthIndex);
  const stats = await storage.closeFlatMonth(flatId, monthKey, closedByUserId);
  let purge: { entries: number; penalties: number } | null = null;
  if (isDeleteLedgerRowsAfterMonthCloseEnabled()) {
    purge = await storage.deleteEntriesAndPenaltiesForAccountingMonth(flatId, monthKey);
  }
  return { stats, purge };
}
