/**
 * Ledger billing policy (enforced by code paths — do not read MonthlyHistory for money).
 *
 * - Bill creation and payment enrichment use `storage.aggregateLedgerForBillingMonth` (accountingMonth + not deleted; no lifecycle filter).
 * - `monthlyHistories` exists for snapshots, history UI, and month-close denormalization — not for billing math.
 * - Migration scripts may read MonthlyHistory once to backfill Entry/Penalty; production routes must not.
 */

export const MONTHLY_HISTORY_FORBIDDEN_FOR_BILLING_AMOUNTS = true as const;
