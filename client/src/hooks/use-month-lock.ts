import { useCallback, useMemo } from "react";
import { useFlatMonths } from "@/hooks/use-flat-months";
import type { MonthLockGateReason } from "@/constants/month-lock";

const KEY_RE = /^\d{4}-\d{2}$/;

function validMonthKey(monthKey: string | null | undefined): monthKey is string {
  return !!monthKey && KEY_RE.test(monthKey);
}

export type MonthLockStatus = "loading" | "unavailable" | "ready";

/**
 * Shared month-lock helpers (one `/api/flat-months` cache entry app-wide).
 * - `interactionDisabled` — true while loading, when status cannot be loaded, or month is locked.
 * - `rowLooksLocked` — visual lock only when we know the month is locked (no flicker, no fake lock on error).
 */
export function useMonthLock() {
  const {
    lockedMonthKeys,
    isPending,
    lockDataUnavailable,
    data,
  } = useFlatMonths();

  const monthStatus: MonthLockStatus = useMemo(() => {
    if (isPending) return "loading";
    if (lockDataUnavailable) return "unavailable";
    return "ready";
  }, [isPending, lockDataUnavailable]);

  const isLocked = useCallback(
    (accountingMonth: string | null | undefined) =>
      validMonthKey(accountingMonth) && lockedMonthKeys.has(accountingMonth),
    [lockedMonthKeys]
  );

  const gateReason = useCallback(
    (accountingMonth: string | null | undefined): MonthLockGateReason => {
      if (isPending) return "loading";
      if (lockDataUnavailable) return "unavailable";
      if (isLocked(accountingMonth)) return "locked";
      return "none";
    },
    [isPending, lockDataUnavailable, isLocked]
  );

  const interactionDisabled = useCallback(
    (accountingMonth: string | null | undefined) =>
      isPending || lockDataUnavailable || isLocked(accountingMonth),
    [isPending, lockDataUnavailable, isLocked]
  );

  const rowLooksLocked = useCallback(
    (accountingMonth: string | null | undefined) =>
      !isPending && !lockDataUnavailable && isLocked(accountingMonth),
    [isPending, lockDataUnavailable, isLocked]
  );

  return {
    isLocked,
    /** True while the first fetch is in flight (no `data` yet). */
    isPending,
    /** Alias for pages that already use `isLoading` for month-lock skeletons. */
    isLoading: isPending,
    monthStatus,
    lockDataUnavailable,
    /** True once we have any successful `data` in cache (may be empty array). */
    hasMonthData: data !== undefined,
    gateReason,
    interactionDisabled,
    rowLooksLocked,
  };
}

/**
 * Lock state for a single accounting month (e.g. bill detail, penalty row).
 */
export function useIsMonthLocked(accountingMonth: string | null | undefined) {
  const {
    isLocked,
    isPending,
    monthStatus,
    lockDataUnavailable,
    interactionDisabled,
    rowLooksLocked,
    gateReason,
  } = useMonthLock();

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
