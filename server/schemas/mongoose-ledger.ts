/**
 * Single source of truth for ledger document fields shared across
 * Entry, Penalty, Bill, and Payment (accounting period + soft delete).
 */
import type { SchemaDefinition } from "mongoose";

export const LEDGER_LIFECYCLE_ENUM = ["active", "archived"] as const;
export type LedgerLifecycleStatus = (typeof LEDGER_LIFECYCLE_ENUM)[number];

export const FLAT_MONTH_STATUS_ENUM = ["active", "locked"] as const;

/** Mongoose field definitions — spread into each ledger collection schema. */
export function ledgerPeriodSchemaFields(): SchemaDefinition {
  return {
    accountingMonth: { type: String, index: true },
    lifecycleStatus: {
      type: String,
      enum: [...LEDGER_LIFECYCLE_ENUM],
      default: "active",
    },
    isDeleted: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  };
}
