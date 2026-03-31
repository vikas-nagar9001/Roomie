/**
 * Recover synthetic Entry + Penalty rows from monthlyHistories (one-time backfill).
 * Idempotent via migrationKey. Does NOT delete or update monthlyHistories.
 *
 * Safety: members are migrated ONLY when snapshot.member.userId is set (no name matching).
 *
 * Requires: MONGODB_URI
 * Penalties need createdBy — set MIGRATION_ACTOR_USER_ID or first flat user is used (logged).
 *
 * Run:   npx tsx server/scripts/migrate-monthly-history-to-ledger.ts
 * Dry:   npx tsx server/scripts/migrate-monthly-history-to-ledger.ts --dry-run
 * Check: npx tsx server/scripts/migrate-monthly-history-to-ledger.ts --validate-only
 */
import "dotenv/config";
import mongoose from "mongoose";
import { storage, EntryModel, PenaltyModel } from "../storage";
import { MonthlyHistoryModel, accountingMonthKeyFromParts } from "../schemas/monthly-history";
import { accountingMonthFromDate, compareAccountingMonthKeys } from "../lib/accounting-month";

void storage;
const UserModel = mongoose.model("User");

const MH_MIGRATION_KEY = /^mh:/;

function memberUserIdString(m: { userId?: unknown }): string | null {
  const u = m?.userId as { _id?: unknown } | string | undefined;
  if (u == null) return null;
  if (typeof u === "string") return u.trim() ? u : null;
  const id = (u as { _id?: unknown })._id ?? u;
  return id != null ? String(id) : null;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function sumMigratedFromDb(): Promise<{ entry: number; penalty: number }> {
  const [eRow] = await EntryModel.aggregate([
    { $match: { migrationKey: { $regex: MH_MIGRATION_KEY } } },
    { $group: { _id: null, t: { $sum: "$amount" } } },
  ]);
  const [pRow] = await PenaltyModel.aggregate([
    { $match: { migrationKey: { $regex: MH_MIGRATION_KEY } } },
    { $group: { _id: null, t: { $sum: "$amount" } } },
  ]);
  return {
    entry: roundMoney(Number(eRow?.t) || 0),
    penalty: roundMoney(Number(pRow?.t) || 0),
  };
}

function expectedFromSnapshots(histories: Array<{ members?: unknown[]; _id?: unknown }>): {
  entry: number;
  penalty: number;
  skippedNoUserId: number;
  skippedEntryAmt: number;
  skippedPenaltyAmt: number;
} {
  let entry = 0;
  let penalty = 0;
  let skippedNoUserId = 0;
  let skippedEntryAmt = 0;
  let skippedPenaltyAmt = 0;
  for (const h of histories) {
    const members = Array.isArray(h.members) ? h.members : [];
    for (const m of members) {
      const uid = memberUserIdString(m as { userId?: unknown });
      if (!uid) {
        skippedNoUserId++;
        skippedEntryAmt += Number((m as { entryAmount?: number }).entryAmount) || 0;
        skippedPenaltyAmt += Number((m as { penaltyAmount?: number }).penaltyAmount) || 0;
        continue;
      }
      entry += Number((m as { entryAmount?: number }).entryAmount) || 0;
      penalty += Number((m as { penaltyAmount?: number }).penaltyAmount) || 0;
    }
  }
  return {
    entry: roundMoney(entry),
    penalty: roundMoney(penalty),
    skippedNoUserId,
    skippedEntryAmt: roundMoney(skippedEntryAmt),
    skippedPenaltyAmt: roundMoney(skippedPenaltyAmt),
  };
}

async function validateTotals(expected: { entry: number; penalty: number }): Promise<boolean> {
  const actual = await sumMigratedFromDb();
  const okE = Math.abs(expected.entry - actual.entry) < 0.02;
  const okP = Math.abs(expected.penalty - actual.penalty) < 0.02;
  console.log(
    `[validate] expected(entry=${expected.entry}, penalty=${expected.penalty}) vs db(entry=${actual.entry}, penalty=${actual.penalty})`,
  );
  if (!okE || !okP) {
    console.error("[validate] FAILED — totals do not match migratable snapshot sums.");
    return false;
  }
  console.log("[validate] OK — entry and penalty totals match.");
  return true;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const validateOnly = process.argv.includes("--validate-only");
  const actorFromEnv = process.env.MIGRATION_ACTOR_USER_ID?.trim();

  await storage.connect();

  const histories = await MonthlyHistoryModel.find({
    $or: [{ isDeleted: { $ne: true } }, { isDeleted: { $exists: false } }],
  }).lean();

  const expected = expectedFromSnapshots(histories as Array<{ members?: unknown[]; _id?: unknown }>);
  if (expected.skippedNoUserId > 0) {
    console.warn(
      `[migrate] ${expected.skippedNoUserId} member row(s) had no userId; amounts not migrated: entry≈${expected.skippedEntryAmt}, penalty≈${expected.skippedPenaltyAmt}`,
    );
  }

  if (validateOnly) {
    const ok = await validateTotals({ entry: expected.entry, penalty: expected.penalty });
    await mongoose.disconnect();
    process.exit(ok ? 0 : 1);
  }

  let entriesCreated = 0;
  let penaltiesCreated = 0;
  let skippedExisting = 0;

  for (const h of histories) {
    const flatId = String(h.flatId);
    const year = Number(h.year);
    const monthIndex = Number(h.monthIndex);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
      console.warn("[migrate] skip history with bad year/monthIndex", h._id);
      continue;
    }
    const accountingMonth =
      typeof h.accountingMonth === "string" && h.accountingMonth.trim()
        ? h.accountingMonth.trim()
        : accountingMonthKeyFromParts(year, monthIndex);

    const nowKey = accountingMonthFromDate(new Date());
    const lifecycleStatus =
      compareAccountingMonthKeys(accountingMonth, nowKey) < 0 ? "archived" : "active";

    const users = await UserModel.find({ flatId: h.flatId }).lean();

    let defaultActor = actorFromEnv;
    if (!defaultActor && users.length > 0) {
      defaultActor = String((users[0] as { _id: unknown })._id);
      console.log(
        `[migrate] flat ${flatId}: using first flat user as createdBy for penalties (set MIGRATION_ACTOR_USER_ID to override)`,
      );
    }
    if (!defaultActor) {
      console.warn(`[migrate] flat ${flatId}: no users — skipping history ${h._id}`);
      continue;
    }

    const members = Array.isArray(h.members) ? h.members : [];
    for (const m of members) {
      const uid = memberUserIdString(m as { userId?: unknown });
      if (!uid) continue;

      const entryAmt = Number((m as { entryAmount?: number }).entryAmount) || 0;
      const penAmt = Number((m as { penaltyAmount?: number }).penaltyAmount) || 0;

      const refDate = new Date(year, monthIndex, 15, 12, 0, 0, 0);
      const incurredAt = new Date(year, monthIndex, 1, 12, 0, 0, 0);

      if (entryAmt > 0) {
        const migrationKey = `mh:${flatId}:${accountingMonth}:entry:${uid}`;
        const exists = await EntryModel.findOne({ flatId: h.flatId, migrationKey }).lean();
        if (exists) {
          skippedExisting++;
          continue;
        }
        if (dryRun) {
          console.log("[dry-run] would create entry", migrationKey, entryAmt);
          entriesCreated++;
          continue;
        }
        await EntryModel.create({
          name: `Historical entry (${accountingMonth})`,
          amount: entryAmt,
          dateTime: refDate,
          status: "APPROVED" as const,
          userId: new mongoose.Types.ObjectId(uid),
          flatId: h.flatId,
          billId: null,
          migrationKey,
          accountingMonth,
          lifecycleStatus,
          isDeleted: false,
          updatedAt: new Date(),
        });
        entriesCreated++;
      }

      if (penAmt > 0) {
        const migrationKey = `mh:${flatId}:${accountingMonth}:penalty:${uid}`;
        const exists = await PenaltyModel.findOne({ flatId: h.flatId, migrationKey }).lean();
        if (exists) {
          skippedExisting++;
          continue;
        }
        if (dryRun) {
          console.log("[dry-run] would create penalty", migrationKey, penAmt);
          penaltiesCreated++;
          continue;
        }
        await PenaltyModel.create({
          userId: new mongoose.Types.ObjectId(uid),
          flatId: h.flatId,
          type: "OTHER" as const,
          amount: penAmt,
          description: `Recovered from monthly history snapshot (${accountingMonth})`,
          createdBy: new mongoose.Types.ObjectId(defaultActor),
          incurredAt,
          billId: null,
          migrationKey,
          accountingMonth,
          lifecycleStatus,
          isDeleted: false,
          updatedAt: new Date(),
        });
        penaltiesCreated++;
      }
    }
  }

  console.log(
    `[migrate] monthlyHistories processed: ${histories.length}; entriesCreated: ${entriesCreated}; penaltiesCreated: ${penaltiesCreated}; skippedExisting: ${skippedExisting}${dryRun ? " (dry-run)" : ""}`,
  );

  if (!dryRun) {
    const ok = await validateTotals({ entry: expected.entry, penalty: expected.penalty });
    await mongoose.disconnect();
    process.exit(ok ? 0 : 1);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
