/**
 * Monthly snapshot summaries — READ-ONLY CACHE / denormalized aggregate for UI and bill-create fast path.
 *
 * Source of truth for money and period state is always: Entry, Penalty, Bill, Payment (+ FlatMonth lock).
 * Bill creation falls back to live ledger queries when no usable snapshot exists; see routes bill handler.
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
