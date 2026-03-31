/**
 * Monthly snapshot summaries — denormalized aggregate for fast UI and month-close only.
 *
 * FORBIDDEN for: billing amounts, payment splits, penalty math, reconciliation (use Entry + Penalty only).
 * Source of truth for money: Entry + Penalty via `aggregateLedgerForBillingMonth` (see server/storage.ts).
 */
import mongoose from "mongoose";
import { ledgerPeriodSchemaFields } from "./mongoose-ledger";

export const MONTH_LONG_NAMES = [
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

const memberEntrySchema = new mongoose.Schema({
  name: { type: String },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  entryAmount: { type: Number, default: 0 },
  penaltyAmount: { type: Number, default: 0 },
  netAmount: { type: Number, default: 0 },
});

const monthlyHistorySchema = new mongoose.Schema({
  flatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Flat",
    required: true,
  },
  month: { type: String },
  year: { type: Number, required: true },
  monthIndex: { type: Number, required: true },
  members: [memberEntrySchema],
  grandTotal: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  ...ledgerPeriodSchemaFields(),
});

monthlyHistorySchema.index({ flatId: 1, year: 1, monthIndex: 1 }, { unique: true });
monthlyHistorySchema.index({ flatId: 1, accountingMonth: 1, lifecycleStatus: 1 });
monthlyHistorySchema.index({ flatId: 1, isDeleted: 1 });

export const MonthlyHistoryModel =
  mongoose.models["MonthlyHistory"] ??
  mongoose.model("MonthlyHistory", monthlyHistorySchema);

export function accountingMonthKeyFromParts(
  year: number,
  monthIndex: number,
): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}
