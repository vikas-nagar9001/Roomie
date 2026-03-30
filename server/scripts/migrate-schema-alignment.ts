/**
 * Backfill standard fields on FlatMonth + PenaltySettings (no $unset, no deletes).
 *
 * Run: npm run migrate:schema-alignment
 */
import "dotenv/config";
import mongoose from "mongoose";
import { FlatMonthModel, PenaltySettingsModel } from "../storage";
import { storage } from "../storage";

async function backfillFlatMonths() {
  let n = 0;
  const cursor = FlatMonthModel.find({
    $or: [
      { accountingMonth: { $exists: false } },
      { accountingMonth: null },
      { accountingMonth: "" },
      { isDeleted: { $exists: false } },
    ],
  }).cursor();

  for await (const doc of cursor) {
    const d = doc as { _id: mongoose.Types.ObjectId; monthKey: string };
    await FlatMonthModel.updateOne(
      { _id: d._id },
      {
        $set: {
          accountingMonth: d.monthKey,
          isDeleted: (doc as { isDeleted?: boolean }).isDeleted === true,
        },
      },
    );
    n++;
  }
  console.log(`[migrate:schema-alignment] flatmonths updated: ${n}`);
}

async function backfillPenaltySettings() {
  let n = 0;
  const cursor = PenaltySettingsModel.find({
    $or: [
      { createdAt: { $exists: false } },
      { lifecycleStatus: { $exists: false } },
      { isDeleted: { $exists: false } },
    ],
  }).cursor();

  for await (const doc of cursor) {
    const d = doc as {
      _id: mongoose.Types.ObjectId;
      updatedAt?: Date;
      lifecycleStatus?: string;
      isDeleted?: boolean;
    };
    await PenaltySettingsModel.updateOne(
      { _id: d._id },
      {
        $set: {
          createdAt: d.updatedAt ?? new Date(),
          lifecycleStatus:
            d.lifecycleStatus === "archived" ? "archived" : "active",
          isDeleted: d.isDeleted === true,
        },
      },
    );
    n++;
  }
  console.log(`[migrate:schema-alignment] penaltysettings updated: ${n}`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await storage.connect();
  await backfillFlatMonths();
  await backfillPenaltySettings();
  console.log("[migrate:schema-alignment] Done.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
