/**
 * Safe migration: backfill accountingMonth + lifecycleStatus + isDeleted.
 * Does NOT remove any documents.
 *
 * Run:  npx tsx server/scripts/migrate-accounting-ledger.ts
 * Optional: append --lock-past-months to lock every month strictly before the current calendar month
 *           (requires MIGRATION_ACTOR_USER_ID=mongoObjectId for FlatMonth.closedBy audit).
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  accountingMonthFromDate,
  accountingMonthFromBillFields,
  currentAccountingMonthKey,
} from "../lib/accounting-month";
import { EntryModel, PenaltyModel, BillModel, PaymentModel } from "../storage";
import { storage } from "../storage";

async function backfillEntries() {
  let count = 0;
  const cursor = EntryModel.find({
    $or: [
      { accountingMonth: { $exists: false } },
      { accountingMonth: null },
      { accountingMonth: "" },
    ],
  }).cursor();

  for await (const e of cursor) {
    const dt = (e as any).dateTime || (e as any).createdAt || new Date();
    const am = accountingMonthFromDate(new Date(dt));
    const setDoc: Record<string, unknown> = {
      accountingMonth: am,
      lifecycleStatus: (e as any).lifecycleStatus || "active",
      isDeleted: (e as any).isDeleted === true,
      updatedAt: new Date(),
    };
    if ((e as any).createdAt == null) {
      setDoc.createdAt = new Date((e as any).dateTime || Date.now());
    }
    await EntryModel.updateOne({ _id: (e as any)._id }, { $set: setDoc });
    count++;
  }
  console.log(`[migrate] entries updated: ${count}`);
}

async function backfillPenalties() {
  let count = 0;
  const cursor = PenaltyModel.find({
    $or: [
      { accountingMonth: { $exists: false } },
      { accountingMonth: null },
      { accountingMonth: "" },
    ],
  }).cursor();

  for await (const p of cursor) {
    const dt = (p as any).createdAt || new Date();
    const am = accountingMonthFromDate(new Date(dt));
    await PenaltyModel.updateOne(
      { _id: (p as any)._id },
      {
        $set: {
          accountingMonth: am,
          lifecycleStatus: (p as any).lifecycleStatus || "active",
          isDeleted: (p as any).isDeleted === true,
          updatedAt: new Date(),
        },
      },
    );
    count++;
  }
  console.log(`[migrate] penalties updated: ${count}`);
}

async function backfillBills() {
  let count = 0;
  const cursor = BillModel.find({
    $or: [
      { accountingMonth: { $exists: false } },
      { accountingMonth: null },
      { accountingMonth: "" },
    ],
  }).cursor();

  for await (const b of cursor) {
    let am: string;
    try {
      am = accountingMonthFromBillFields(String((b as any).month), Number((b as any).year));
    } catch {
      am = accountingMonthFromDate(new Date((b as any).createdAt || Date.now()));
    }
    await BillModel.updateOne(
      { _id: (b as any)._id },
      {
        $set: {
          accountingMonth: am,
          lifecycleStatus: (b as any).lifecycleStatus || "active",
          updatedAt: new Date(),
        },
      },
    );
    count++;
  }
  console.log(`[migrate] bills updated: ${count}`);
}

async function backfillPayments() {
  let count = 0;
  const cursor = PaymentModel.find({
    $or: [
      { accountingMonth: { $exists: false } },
      { accountingMonth: null },
      { accountingMonth: "" },
    ],
  }).cursor();

  for await (const pay of cursor) {
    const bill = await BillModel.findById((pay as any).billId).lean();
    let am: string | undefined = bill ? (bill as any).accountingMonth : undefined;
    if (!am && bill) {
      try {
        am = accountingMonthFromBillFields(String((bill as any).month), Number((bill as any).year));
      } catch {
        am = undefined;
      }
    }
    if (!am) {
      am = accountingMonthFromDate(new Date((pay as any).createdAt || Date.now()));
    }
    await PaymentModel.updateOne(
      { _id: (pay as any)._id },
      {
        $set: {
          accountingMonth: am,
          lifecycleStatus: (pay as any).lifecycleStatus || "active",
          updatedAt: new Date(),
        },
      },
    );
    count++;
  }
  console.log(`[migrate] payments updated: ${count}`);
}

async function lockPastMonths(actorUserId?: string) {
  const cur = currentAccountingMonthKey();
  const flatIds = await EntryModel.distinct("flatId");
  for (const fid of flatIds) {
    const keys = new Set<string>();
    const merge = async (model: mongoose.Model<unknown>, field = "accountingMonth") => {
      const vals = await model.distinct(field, { flatId: fid });
      for (const v of vals as string[]) {
        if (v && typeof v === "string" && v < cur) keys.add(v);
      }
    };
    await merge(EntryModel as any);
    await merge(PenaltyModel as any);
    await merge(BillModel as any);
    await merge(PaymentModel as any);

    for (const mk of Array.from(keys)) {
      await storage.closeFlatMonth(String(fid), mk, actorUserId);
      console.log(`[migrate] locked ${mk} for flat ${fid}`);
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await storage.connect();

  console.log("[migrate] Backfilling accountingMonth / lifecycle…");
  await backfillEntries();
  await backfillPenalties();
  await backfillBills();
  await backfillPayments();

  if (process.argv.includes("--lock-past-months")) {
    const actor = process.env.MIGRATION_ACTOR_USER_ID;
    if (!actor) {
      console.warn("[migrate] MIGRATION_ACTOR_USER_ID not set — closing months without closedBy audit");
    }
    console.log("[migrate] Locking all months before", currentAccountingMonthKey());
    await lockPastMonths(actor);
  }

  console.log("[migrate] Done.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
