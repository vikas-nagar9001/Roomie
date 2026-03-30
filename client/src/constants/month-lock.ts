/** User-facing copy when an accounting month is closed (ledger locked). */
export const MONTH_LOCKED_MESSAGE =
  "This month is locked and cannot be modified";

/** When flat-months cannot be loaded and there is no cached data — fail closed. */
export const MONTH_LOCK_UNAVAILABLE_MESSAGE =
  "Could not load month lock status. Ledger changes are temporarily unavailable.";

export type MonthLockGateReason = "none" | "loading" | "unavailable" | "locked";

/** Accessible name for a control blocked by month-lock gating. */
export function monthLockActionAria(
  actionLabel: string,
  reason: MonthLockGateReason
): string {
  switch (reason) {
    case "loading":
      return `${actionLabel}. Loading month lock status.`;
    case "unavailable":
      return `${actionLabel}. ${MONTH_LOCK_UNAVAILABLE_MESSAGE}`;
    case "locked":
      return `${actionLabel}. ${MONTH_LOCKED_MESSAGE}`;
    default:
      return actionLabel;
  }
}

/** Short string for tooltips on disabled controls. */
export function monthLockBlockTooltip(reason: MonthLockGateReason): string {
  switch (reason) {
    case "loading":
      return "Loading month lock status…";
    case "unavailable":
      return MONTH_LOCK_UNAVAILABLE_MESSAGE;
    case "locked":
      return MONTH_LOCKED_MESSAGE;
    default:
      return MONTH_LOCKED_MESSAGE;
  }
}
