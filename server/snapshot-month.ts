/**
 * Persisted monthly totals for History / bills — used by admin snapshot, auto-rollover, and month close.
 */
import { storage } from "./storage";
import {
  MonthlyHistoryModel,
  MONTH_LONG_NAMES,
  accountingMonthKeyFromParts,
} from "./schemas/monthly-history";

export async function snapshotMonthForFlat(flatId: string, year: number, monthIndex: number) {
  const startOfMonth = new Date(year, monthIndex, 1);
  const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const [allEntries, allPenalties, users] = await Promise.all([
    storage.getEntriesByFlatId(flatId, { includeArchived: true, includeDeleted: true }),
    storage.getPenaltiesByFlatId(flatId, { includeArchived: true, includeDeleted: true }),
    storage.getUsersByFlatId(flatId),
  ]);

  const entries = allEntries.filter(e => {
    const d = new Date(e.dateTime || e.createdAt);
    return d >= startOfMonth && d <= endOfMonth && e.status === "APPROVED";
  });
  const penalties = allPenalties.filter(p => {
    const d = new Date(p.createdAt);
    return d >= startOfMonth && d <= endOfMonth;
  });

  const memberMap: Record<string, { name: string; userId: unknown; entryAmount: number; penaltyAmount: number }> =
    {};
  for (const u of users) {
    memberMap[u._id.toString()] = { name: u.name, userId: u._id, entryAmount: 0, penaltyAmount: 0 };
  }
  for (const e of entries) {
    const uid =
      typeof e.userId === "object"
        ? String((e.userId as { _id?: unknown })._id ?? e.userId)
        : String(e.userId);
    if (!memberMap[uid]) {
      memberMap[uid] = {
        name: (e.userId as { name?: string })?.name ?? "Unknown",
        userId: uid,
        entryAmount: 0,
        penaltyAmount: 0,
      };
    }
    memberMap[uid].entryAmount += e.amount ?? 0;
  }
  for (const p of penalties) {
    const uid =
      typeof p.userId === "object"
        ? String((p.userId as { _id?: unknown })._id ?? p.userId)
        : String(p.userId);
    if (!memberMap[uid]) {
      memberMap[uid] = {
        name: (p.userId as { name?: string })?.name ?? "Unknown",
        userId: uid,
        entryAmount: 0,
        penaltyAmount: 0,
      };
    }
    memberMap[uid].penaltyAmount += p.amount ?? 0;
  }

  const members = Object.values(memberMap).map(m => ({
    name: m.name,
    userId: m.userId,
    entryAmount: m.entryAmount,
    penaltyAmount: m.penaltyAmount,
    netAmount: m.entryAmount - m.penaltyAmount,
  }));
  const grandTotal = members.reduce((s, m) => s + m.entryAmount, 0);
  const accountingMonth = accountingMonthKeyFromParts(year, monthIndex);
  const now = new Date();

  return MonthlyHistoryModel.findOneAndUpdate(
    { flatId, year, monthIndex },
    {
      $set: {
        flatId,
        month: MONTH_LONG_NAMES[monthIndex],
        year,
        monthIndex,
        members,
        grandTotal,
        accountingMonth,
        lifecycleStatus: "active",
        isDeleted: false,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, new: true },
  );
}
