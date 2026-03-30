/**
 * Safe backfill for monthlyhistories: accountingMonth, updatedAt, lifecycleStatus, isDeleted.
 * Does not remove or rename fields.
 *
 * Run: npm run migrate:monthly-history
 */
import "dotenv/config";
import mongoose from "mongoose";
import { MonthlyHistoryModel, accountingMonthKeyFromParts } from "../schemas/monthly-history";
import { storage } from "../storage";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await storage.connect();

  let n = 0;
  const cursor = MonthlyHistoryModel.find({
    $or: [
      { accountingMonth: { $exists: false } },
      { accountingMonth: null },
      { accountingMonth: "" },
      { updatedAt: { $exists: false } },
      { lifecycleStatus: { $exists: false } },
      { isDeleted: { $exists: false } },
    ],
  }).cursor();

  for await (const doc of cursor) {
    const d = doc as {
      _id: mongoose.Types.ObjectId;
      year: number;
      monthIndex: number;
      createdAt?: Date;
      lifecycleStatus?: string;
      isDeleted?: boolean;
    };
    const accountingMonth = accountingMonthKeyFromParts(d.year, d.monthIndex);
    const updatedAt = d.createdAt ?? new Date();
    await MonthlyHistoryModel.updateOne(
      { _id: d._id },
      {
        $set: {
          accountingMonth,
          updatedAt,
          lifecycleStatus:
            d.lifecycleStatus === "archived" ? "archived" : "active",
          isDeleted: d.isDeleted === true,
        },
      },
    );
    n++;
  }

  console.log(`[migrate:monthly-history] documents updated: ${n}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
