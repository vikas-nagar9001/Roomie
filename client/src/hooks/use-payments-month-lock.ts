import { useMemo } from "react";
import { useMonthLock } from "@/hooks/use-month-lock";

/**
 * Payments uses the same month-lock rules as entries/penalties: `/api/flat-months`
 * (`status === "locked"` → no edits). No calendar-month exceptions.
 */
export function usePaymentsMonthLock() {
  return useMonthLock();
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
