import { cn } from "@/lib/utils";
import {
  MONTH_LOCKED_MESSAGE,
  MONTH_LOCK_UNAVAILABLE_MESSAGE,
} from "@/constants/month-lock";
import { Skeleton } from "@/components/ui/skeleton";

export { MONTH_LOCKED_MESSAGE, MONTH_LOCK_UNAVAILABLE_MESSAGE };

/** Inline lock marker (decorative when adjacent cell explains state; otherwise labeled). */
export function MonthLockIcon({
  className,
  decorative = false,
}: {
  className?: string;
  /** When true, hide from assistive tech (e.g. row has other text). */
  decorative?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 text-sm leading-none opacity-90", className)}
      title={decorative ? undefined : MONTH_LOCKED_MESSAGE}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : MONTH_LOCKED_MESSAGE}
      role={decorative ? undefined : "img"}
    >
      🔒
    </span>
  );
}

/** Amber notice — month is closed. */
export function MonthLockedBanner({
  className,
  message = MONTH_LOCKED_MESSAGE,
}: {
  className?: string;
  message?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-xs sm:text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2",
        className
      )}
    >
      {message}
    </p>
  );
}

/** API failure with no cache — fail closed. */
export function MonthLockUnavailableBanner({ className }: { className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        "text-xs sm:text-sm text-red-200/90 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2",
        className
      )}
    >
      {MONTH_LOCK_UNAVAILABLE_MESSAGE}
    </p>
  );
}

/** Loading month-lock data (polite status region). */
export function MonthLockStatusSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("w-full max-w-xl", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading month lock status"
    >
      <Skeleton className="h-9 w-full rounded-lg bg-white/[0.06]" aria-hidden />
    </div>
  );
}

/** Table row: slight fade when month is confirmed locked. */
export function lockedRowClassName(looksLocked: boolean) {
  return cn(looksLocked && "opacity-[0.72] saturate-[0.85]");
}

/** Cursor when a control is blocked by month status (loading vs locked/unavailable). */
export function monthLockWaitCursor(loading: boolean) {
  return loading ? "cursor-wait" : "cursor-not-allowed";
}
