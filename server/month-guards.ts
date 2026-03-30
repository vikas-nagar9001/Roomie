import type { IStorage } from "./storage";
import { accountingMonthFromDate, accountingMonthFromBillFields } from "./lib/accounting-month";
import {
  ARCHIVED_LEDGER_MESSAGE,
  createMonthLockedError,
} from "./lib/month-ledger-error";

const MONTH_KEY = /^\d{4}-\d{2}$/;

/** Canonical entry period from dateTime only (never trust stored accountingMonth). */
export function resolveEntryMonthKey(entry: { dateTime?: Date | string }): string {
  if (entry.dateTime == null || entry.dateTime === "") {
    const e = new Error("Entry dateTime is required");
    (e as { statusCode?: number }).statusCode = 400;
    (e as { code?: string }).code = "MISSING_DATETIME";
    throw e;
  }
  const d = new Date(entry.dateTime);
  if (isNaN(d.getTime())) {
    const e = new Error("Invalid entry dateTime");
    (e as { statusCode?: number }).statusCode = 400;
    (e as { code?: string }).code = "INVALID_DATETIME";
    throw e;
  }
  return accountingMonthFromDate(d);
}

/** Bill period from month/year (or dueDate); never trust stored accountingMonth. */
export function resolveBillMonthKey(bill: {
  month: string;
  year: number;
  dueDate?: Date | string;
}): string {
  try {
    return accountingMonthFromBillFields(String(bill.month), Number(bill.year));
  } catch {
    if (bill.dueDate == null) {
      const e = new Error(
        "Bill has an invalid month/year; cannot determine accounting month.",
      );
      (e as { statusCode?: number }).statusCode = 400;
      throw e;
    }
    const d = new Date(bill.dueDate);
    if (isNaN(d.getTime())) {
      const e = new Error("Bill dueDate is invalid");
      (e as { statusCode?: number }).statusCode = 400;
      (e as { code?: string }).code = "INVALID_DATETIME";
      throw e;
    }
    return accountingMonthFromDate(d);
  }
}

/** Penalty period from incurredAt or createdAt; never trust stored accountingMonth. */
export function resolvePenaltyMonthKey(penalty: {
  incurredAt?: Date | string;
  createdAt?: Date | string;
}): string {
  const raw = penalty.incurredAt ?? penalty.createdAt;
  if (raw == null) {
    const e = new Error("Penalty is missing incurredAt/createdAt");
    (e as { statusCode?: number }).statusCode = 400;
    (e as { code?: string }).code = "MISSING_DATETIME";
    throw e;
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    const e = new Error("Invalid penalty date");
    (e as { statusCode?: number }).statusCode = 400;
    (e as { code?: string }).code = "INVALID_DATETIME";
    throw e;
  }
  return accountingMonthFromDate(d);
}

/**
 * Central guard: valid YYYY-MM + FlatMonth not locked + sole active month rules.
 */
export async function assertMonthEditable(
  storage: IStorage,
  flatId: string,
  monthKey: string,
): Promise<void> {
  if (!MONTH_KEY.test(monthKey)) {
    const e = new Error("Invalid month format. Use YYYY-MM.");
    (e as { statusCode?: number }).statusCode = 400;
    (e as { code?: string }).code = "INVALID_MONTH_KEY";
    throw e;
  }
  await storage.assertAccountingMonthOpen(flatId, monthKey);
}

export async function assertEntryLedgerOpen(
  storage: IStorage,
  flatId: string,
  entry: {
    flatId?: unknown;
    lifecycleStatus?: string;
    dateTime?: Date | string;
  } | null,
): Promise<void> {
  if (!entry) {
    const e = new Error("Entry not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (String(entry.flatId) !== String(flatId)) {
    const e = new Error("Entry not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (entry.lifecycleStatus === "archived") {
    throw createMonthLockedError(ARCHIVED_LEDGER_MESSAGE);
  }
  const mk = resolveEntryMonthKey(entry);
  await assertMonthEditable(storage, flatId, mk);
}

export async function assertBillLedgerOpen(storage: IStorage, flatId: string, bill: any): Promise<void> {
  if (!bill) {
    const e = new Error("Bill not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (String(bill.flatId) !== String(flatId)) {
    const e = new Error("Bill not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (bill.lifecycleStatus === "archived") {
    throw createMonthLockedError(ARCHIVED_LEDGER_MESSAGE);
  }
  const mk = resolveBillMonthKey(bill);
  await assertMonthEditable(storage, flatId, mk);
}

export async function assertPaymentLedgerOpen(storage: IStorage, flatId: string, payment: any): Promise<void> {
  if (!payment) {
    const e = new Error("Payment not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (String(payment.flatId) !== String(flatId)) {
    const e = new Error("Payment not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (payment.lifecycleStatus === "archived") {
    throw createMonthLockedError(ARCHIVED_LEDGER_MESSAGE);
  }
  const bill = await storage.getBillById(String(payment.billId));
  await assertBillLedgerOpen(storage, flatId, bill);
}

export async function assertPenaltyLedgerOpen(
  storage: IStorage,
  flatId: string,
  penalty: {
    flatId?: unknown;
    lifecycleStatus?: string;
    incurredAt?: Date | string;
    createdAt?: Date | string;
  } | null | undefined,
): Promise<void> {
  if (!penalty) {
    const e = new Error("Penalty not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (String(penalty.flatId) !== String(flatId)) {
    const e = new Error("Penalty not found");
    (e as { statusCode?: number }).statusCode = 404;
    throw e;
  }
  if (penalty.lifecycleStatus === "archived") {
    throw createMonthLockedError(ARCHIVED_LEDGER_MESSAGE);
  }
  const mk = resolvePenaltyMonthKey(penalty);
  await assertMonthEditable(storage, flatId, mk);
}
