import { useCallback, useMemo } from "react";
import type { MonthLockGateReason } from "@/constants/month-lock";
import { useMonthLock } from "@/hooks/use-month-lock";

const KEY_RE = /^\d{4}-\d{2}$/;

function calendarMonthFromKey(monthKey: string | null | undefined): number | null {
  if (!monthKey || !KEY_RE.test(monthKey)) return null;
  return parseInt(monthKey.slice(5, 7), 10);
}

function isMarchMonthKey(monthKey: string | null | undefined): boolean {
  return calendarMonthFromKey(monthKey) === 3;
}

/**
 * Payments-only: when flat-month data is ready, only **March** (month 03, any year)
 * stays editable; every other month is treated as locked in this UI. March also
 * ignores server flat-month lock here so it stays open for bill edits.
 */
export function usePaymentsMonthLock() {
  const base = useMonthLock();

  /** True once we know lock data: lock every month except March. */
  const hardLockNonMarch = useCallback(
    (monthKey: string | null | undefined) =>
      base.monthStatus === "ready" &&
      calendarMonthFromKey(monthKey) != null &&
      !isMarchMonthKey(monthKey),
    [base.monthStatus]
  );

  const interactionDisabled = useCallback(
    (monthKey: string | null | undefined) => {
      if (base.monthStatus === "ready" && isMarchMonthKey(monthKey)) return false;
      return base.interactionDisabled(monthKey) || hardLockNonMarch(monthKey);
    },
    [base.monthStatus, base.interactionDisabled, hardLockNonMarch]
  );

  const gateReason = useCallback(
    (monthKey: string | null | undefined): MonthLockGateReason => {
      if (base.monthStatus === "ready" && isMarchMonthKey(monthKey)) return "none";
      if (hardLockNonMarch(monthKey)) return "locked";
      return base.gateReason(monthKey);
    },
    [base.monthStatus, base.gateReason, hardLockNonMarch]
  );

  const isLocked = useCallback(
    (monthKey: string | null | undefined) => {
      if (base.monthStatus === "ready" && isMarchMonthKey(monthKey)) return false;
      return base.isLocked(monthKey) || hardLockNonMarch(monthKey);
    },
    [base.monthStatus, base.isLocked, hardLockNonMarch]
  );

  const rowLooksLocked = useCallback(
    (monthKey: string | null | undefined) => {
      if (base.monthStatus === "ready" && isMarchMonthKey(monthKey)) return false;
      return base.rowLooksLocked(monthKey) || hardLockNonMarch(monthKey);
    },
    [base.monthStatus, base.rowLooksLocked, hardLockNonMarch]
  );

  return {
    ...base,
    interactionDisabled,
    gateReason,
    isLocked,
    rowLooksLocked,
  };
}

export function usePaymentsIsMonthLocked(accountingMonth: string | null | undefined) {
  const {
    isLocked,
    isPending,
    monthStatus,
    lockDataUnavailable,
    interactionDisabled,
    rowLooksLocked,
    gateReason,
  } = usePaymentsMonthLock();

  return useMemo(
    () => ({
      isLocked: isLocked(accountingMonth),
      isLoading: isPending,
      monthStatus,
      lockDataUnavailable,
      interactionDisabled: interactionDisabled(accountingMonth),
      rowLooksLocked: rowLooksLocked(accountingMonth),
      gateReason: gateReason(accountingMonth),
    }),
    [
      accountingMonth,
      isLocked,
      isPending,
      monthStatus,
      lockDataUnavailable,
      interactionDisabled,
      rowLooksLocked,
      gateReason,
    ]
  );
}
