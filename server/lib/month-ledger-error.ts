/**
 * Standard errors for accounting month locks (fintech-style period immutability).
 */

export const MONTH_LOCKED_DEFAULT_MESSAGE =
  "This month is locked and cannot be modified";

export function createMonthLockedError(
  message: string = MONTH_LOCKED_DEFAULT_MESSAGE,
): Error {
  const err = new Error(message);
  (err as NodeJS.ErrnoException & { statusCode?: number }).code =
    "MONTH_LOCKED";
  (err as { statusCode?: number }).statusCode = 403;
  return err;
}

/** Archived ledger rows are treated the same as locked months for API clients. */
export const ARCHIVED_LEDGER_MESSAGE =
  "This period is closed and cannot be modified";

export function createNewerMonthActiveError(
  activeMonthKey: string,
  targetMonthKey: string,
): Error {
  const err = new Error(
    `A newer accounting month (${activeMonthKey}) is open. Close it before recording in ${targetMonthKey}.`,
  );
  (err as NodeJS.ErrnoException & { statusCode?: number }).code =
    "NEWER_MONTH_ACTIVE";
  (err as { statusCode?: number }).statusCode = 409;
  return err;
}
