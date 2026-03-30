/**
 * Reconcile accountingMonth with canonical date fields, dedupe multiple active FlatMonths,
 * backfill penalty incurredAt, and apply FlatMonth partial unique index.
 *
 * Safe: no deletes. Run after backup:
 *   npm run migrate:consistency
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  accountingMonthFromDate,
  accountingMonthFromBillFields,
} from "../lib/accounting-month";
import {
  EntryModel,
  PenaltyModel,
  BillModel,
  PaymentModel,
  FlatMonthModel,
} from "../storage";
import { storage } from "../storage";

async function backfillPenaltyIncurredAt() {
  let n = 0;
  const cursor = PenaltyModel.find({
    $or: [{ incurredAt: { $exists: false } }, { incurredAt: null }],
  }).cursor();
  for await (const p of cursor) {
    const created = (p as { createdAt?: Date }).createdAt;
    if (!created) continue;
    await PenaltyModel.updateOne(
      { _id: (p as { _id: unknown })._id },
      { $set: { incurredAt: created } },
    );
    n++;
  }
  console.log(`[consistency] penalties incurredAt backfill: ${n}`);
}

async function syncEntryMonths() {
  let n = 0;
  const cursor = EntryModel.find({}).cursor();
  for await (const e of cursor) {
    const dt = (e as { dateTime?: Date; updatedAt?: Date }).dateTime ?? (e as { updatedAt?: Date }).updatedAt;
    if (!dt) {
      console.warn("[consistency] entry missing dateTime:", String((e as { _id: unknown })._id));
      continue;
    }
    const expected = accountingMonthFromDate(new Date(dt));
    if ((e as { accountingMonth?: string }).accountingMonth !== expected) {
      await EntryModel.updateOne(
        { _id: (e as { _id: unknown })._id },
        { $set: { accountingMonth: expected, updatedAt: new Date() } },
      );
      n++;
    }
  }
  console.log(`[consistency] entry rows realigned: ${n}`);
}

async function syncPenaltyMonths() {
  let n = 0;
  const cursor = PenaltyModel.find({}).cursor();
  for await (const p of cursor) {
    const ref =
      (p as { incurredAt?: Date; createdAt?: Date }).incurredAt ??
      (p as { createdAt?: Date }).createdAt;
    if (!ref) continue;
    const expected = accountingMonthFromDate(new Date(ref));
    if ((p as { accountingMonth?: string }).accountingMonth !== expected) {
      await PenaltyModel.updateOne(
        { _id: (p as { _id: unknown })._id },
        { $set: { accountingMonth: expected, updatedAt: new Date() } },
      );
      n++;
    }
  }
  console.log(`[consistency] penalty rows realigned: ${n}`);
}

async function syncBillMonths() {
  let n = 0;
  const cursor = BillModel.find({}).cursor();
  for await (const b of cursor) {
    let expected: string;
    try {
      expected = accountingMonthFromBillFields(
        String((b as { month: string }).month),
        Number((b as { year: number }).year),
      );
    } catch {
      const due = (b as { dueDate?: Date }).dueDate;
      if (!due || isNaN(new Date(due).getTime())) continue;
      expected = accountingMonthFromDate(new Date(due));
    }
    if ((b as { accountingMonth?: string }).accountingMonth !== expected) {
      await BillModel.updateOne(
        { _id: (b as { _id: unknown })._id },
        { $set: { accountingMonth: expected, updatedAt: new Date() } },
      );
      n++;
    }
  }
  console.log(`[consistency] bill rows realigned: ${n}`);
}

async function syncPaymentMonths() {
  let n = 0;
  const cursor = PaymentModel.find({}).cursor();
  for await (const pay of cursor) {
    const bill = await BillModel.findById((pay as { billId: unknown }).billId).lean();
    if (!bill) continue;
    let expected: string;
    try {
      expected = accountingMonthFromBillFields(
        String((bill as { month: string }).month),
        Number((bill as { year: number }).year),
      );
    } catch {
      const due = (bill as { dueDate?: Date }).dueDate;
      if (!due || isNaN(new Date(due).getTime())) continue;
      expected = accountingMonthFromDate(new Date(due));
    }
    if ((pay as { accountingMonth?: string }).accountingMonth !== expected) {
      await PaymentModel.updateOne(
        { _id: (pay as { _id: unknown })._id },
        { $set: { accountingMonth: expected, updatedAt: new Date() } },
      );
      n++;
    }
  }
  console.log(`[consistency] payment rows realigned: ${n}`);
}

async function dedupeActiveFlatMonths() {
  const flatIds = await FlatMonthModel.distinct("flatId");
  let closed = 0;
  for (const fid of flatIds) {
    const actives = await FlatMonthModel.find({
      flatId: fid,
      status: "active",
    })
      .sort({ monthKey: 1 })
      .lean();
    if (actives.length <= 1) continue;
    for (let i = 0; i < actives.length - 1; i++) {
      const row = actives[i] as { monthKey: string };
      await storage.closeFlatMonth(String(fid), row.monthKey);
      closed++;
    }
  }
  console.log(`[consistency] extra active FlatMonths closed (archived): ${closed}`);
}

async function syncFlatMonthIndexes() {
  await FlatMonthModel.syncIndexes();
  console.log("[consistency] FlatMonth indexes synced (incl. partial unique on active)");
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await storage.connect();
  await backfillPenaltyIncurredAt();
  await syncEntryMonths();
  await syncPenaltyMonths();
  await syncBillMonths();
  await syncPaymentMonths();
  await dedupeActiveFlatMonths();
  await syncFlatMonthIndexes();
  console.log("[consistency] done.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
