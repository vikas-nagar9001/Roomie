/** Long month names — aligned with server bill `month` field and payments UI. */
export const CAL_MONTH_LONG_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Canonical ledger key "YYYY-MM" from a calendar date. */
export function accountingMonthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Ledger key from bill `year` + display `month` string. */
export function accountingMonthKeyFromBillMonth(year: number, monthLongName: string): string {
  const idx = CAL_MONTH_LONG_NAMES.indexOf(monthLongName as (typeof CAL_MONTH_LONG_NAMES)[number]);
  const m = idx >= 0 ? idx + 1 : new Date().getMonth() + 1;
  return `${year}-${String(m).padStart(2, "0")}`;
}

export function entryAccountingMonthKey(entry: {
  dateTime: string | Date;
  accountingMonth?: string;
}): string {
  if (entry.accountingMonth && /^\d{4}-\d{2}$/.test(entry.accountingMonth)) {
    return entry.accountingMonth;
  }
  return accountingMonthKeyFromDate(new Date(entry.dateTime));
}

export function penaltyAccountingMonthKey(penalty: {
  createdAt?: string | Date;
  incurredAt?: string | Date;
  accountingMonth?: string;
}): string {
  if (penalty.accountingMonth && /^\d{4}-\d{2}$/.test(penalty.accountingMonth)) {
    return penalty.accountingMonth;
  }
  const ref = penalty.incurredAt ?? penalty.createdAt ?? new Date();
  return accountingMonthKeyFromDate(new Date(ref));
}
