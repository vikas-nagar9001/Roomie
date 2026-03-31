/**
 * Canonical accounting period key: "YYYY-MM" (calendar month in local/server TZ).
 * Used for month locking, lifecycle, and queries — fintech-style period boundaries.
 */

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function accountingMonthFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Lexicographic compare for YYYY-MM keys. Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareAccountingMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Parse "YYYY-MM" → { year, monthIndex 0–11 } */
export function parseAccountingMonthKey(key: string): { year: number; monthIndex: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key?.trim() || "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

export function accountingMonthFromBillFields(monthName: string, year: number): string {
  const idx = MONTH_LONG.findIndex(
    (n) => n.toLowerCase() === String(monthName || "").trim().toLowerCase(),
  );
  if (idx < 0) {
    throw new Error(`Invalid bill month name: ${monthName}`);
  }
  return `${year}-${String(idx + 1).padStart(2, "0")}`;
}

export function currentAccountingMonthKey(now = new Date()): string {
  return accountingMonthFromDate(now);
}

/** Calendar month immediately before the one containing `now` (for auto-close jobs). */
export function previousCalendarMonthKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m === 0) return `${y - 1}-12`;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Current calendar month and the two before it (YYYY-MM), newest first. Used for bill creation window. */
export function rollingThreeMonthBillWindowKeys(now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(accountingMonthFromDate(d));
  }
  return keys;
}

export function isInRollingThreeMonthBillWindow(monthKey: string, now = new Date()): boolean {
  return rollingThreeMonthBillWindowKeys(now).includes(monthKey);
}
