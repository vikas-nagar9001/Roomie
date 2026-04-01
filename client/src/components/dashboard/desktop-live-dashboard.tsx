import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  FiList,
  FiCreditCard,
  FiAlertTriangle,
  FiClock,
  FiUsers,
  FiArrowUpRight,
  FiLock,
  FiActivity,
  FiZap,
  FiCheckCircle,
} from "react-icons/fi";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@shared/schema";
import {
  accountingMonthKeyFromBillMonth,
  accountingMonthKeyFromDate,
  entryAccountingMonthKey,
  penaltyAccountingMonthKey,
} from "@/lib/accounting-month";
import { useMonthLock } from "@/hooks/use-month-lock";
import {
  MonthLockedBanner,
  MonthLockUnavailableBanner,
} from "@/components/month-lock-ui";
import { monthLockBlockTooltip } from "@/constants/month-lock";

const LIVE_STALE_MS = 8_000;
const LIVE_REFETCH_MS = 15_000;

const COLORS = {
  paid: "#a78bfa",
  outstanding: "#fb7185",
  entries: "#34d399",
  penalties: "#fbbf24",
  neutral: "rgba(255,255,255,0.12)",
} as const;

function fmt(n: number) {
  return `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function uid(u: unknown): string {
  if (u == null) return "";
  if (typeof u === "object" && u !== null && "_id" in u) {
    return String((u as { _id?: unknown })._id ?? "");
  }
  return String(u);
}

function effectivePaymentDue(p: {
  totalDue?: number;
  amount: number;
  penalty?: number;
  penaltyWaived?: boolean;
}): number {
  const base = p.totalDue != null && p.totalDue > 0 ? p.totalDue : p.amount;
  const penalty = p.penaltyWaived ? 0 : Number(p.penalty) || 0;
  return base + penalty;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2) || "?";
}

interface BillSummary {
  _id: string;
  month: string;
  year: number;
  totalAmount: number;
}

interface PaymentRecord {
  _id: string;
  userId: { _id: string; name: string; profilePicture?: string };
  amount: number;
  paidAmount: number;
  totalDue: number;
  penalty: number;
  penaltyWaived: boolean;
  paidAt?: string;
}

interface BillDetail extends BillSummary {
  payments: PaymentRecord[];
}

interface EntryRow {
  _id?: string;
  name: string;
  amount: number;
  status: string;
  dateTime: string;
  createdAt?: string;
  userId: unknown;
}

interface PenaltyRow {
  _id?: string;
  amount: number;
  description: string;
  type: string;
  createdAt: string;
  userId: unknown;
}

type FeedItem = {
  id: string;
  ts: Date;
  kind: "entry" | "payment" | "penalty";
  title: string;
  sub: string;
  amount?: number;
  href: string;
};

type DonutSeg = { name: string; value: number; fill: string };

const queryLive = {
  staleTime: LIVE_STALE_MS,
  refetchInterval: LIVE_REFETCH_MS,
  refetchOnWindowFocus: true,
} as const;

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<DonutSeg & { payload?: DonutSeg }>;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]!;
  const p = raw.payload ?? raw;
  return (
    <div className="rounded-xl border border-white/10 bg-[#16162a]/95 px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-white">{p.name}</p>
      <p className="text-[#c49bff] tabular-nums mt-0.5">{fmt(p.value)}</p>
    </div>
  );
}

export function DesktopLiveDashboard({ user }: { user: User | null | undefined }) {
  const now = new Date();
  const monthKey = accountingMonthKeyFromDate(now);
  const monthTitle = format(now, "MMMM yyyy");

  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSyncTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const {
    interactionDisabled,
    rowLooksLocked,
    gateReason,
    isPending: monthLockPending,
    lockDataUnavailable,
  } = useMonthLock();

  const actionsDisabled = interactionDisabled(monthKey);
  const monthLocked = rowLooksLocked(monthKey);
  const lockTooltip = monthLockBlockTooltip(gateReason(monthKey));
  const isAdmin = user?.role === "ADMIN" || user?.role === "CO_ADMIN";

  const entriesQ = useQuery<EntryRow[]>({
    queryKey: ["/api/entries"],
    ...queryLive,
  });
  const penaltiesQ = useQuery<PenaltyRow[]>({
    queryKey: ["/api/penalties"],
    ...queryLive,
  });
  const billsQ = useQuery<BillSummary[]>({
    queryKey: ["/api/bills"],
    ...queryLive,
  });
  const membersQ = useQuery<User[]>({
    queryKey: ["/api/users"],
    ...queryLive,
  });

  const entries = entriesQ.data ?? [];
  const entriesLoading = entriesQ.isLoading;
  const penalties = penaltiesQ.data ?? [];
  const penaltiesLoading = penaltiesQ.isLoading;
  const bills = billsQ.data ?? [];
  const billsLoading = billsQ.isLoading;
  const members = membersQ.data ?? [];
  const membersLoading = membersQ.isLoading;

  const lastSyncMs = Math.max(
    entriesQ.dataUpdatedAt,
    penaltiesQ.dataUpdatedAt,
    billsQ.dataUpdatedAt,
    membersQ.dataUpdatedAt,
  );
  const anyFetching =
    entriesQ.isFetching || penaltiesQ.isFetching || billsQ.isFetching || membersQ.isFetching;

  const currentBillSummary = useMemo(() => {
    return bills.find((b) => accountingMonthKeyFromBillMonth(b.year, b.month) === monthKey) ?? null;
  }, [bills, monthKey]);

  const currentBillId = currentBillSummary?._id;

  const billQ = useQuery<BillDetail>({
    queryKey: ["/api/bills", currentBillId],
    queryFn: async () => {
      const res = await fetch(`/api/bills/${currentBillId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bill");
      return res.json();
    },
    enabled: Boolean(currentBillId),
    ...queryLive,
  });

  const billDetail = billQ.data;
  const billDetailLoading = billQ.isLoading;
  const billFetching = billQ.isFetching;

  const latestMarchBill = useMemo(() => {
    const mar = bills.filter((b) => String(b.month).trim().toLowerCase() === "march");
    return mar.sort((a, b) => b.year - a.year)[0] ?? null;
  }, [bills]);

  const marchBillId = latestMarchBill?._id ?? null;
  const marchBillSameAsCurrent = Boolean(marchBillId && marchBillId === currentBillId);

  const marchBillQ = useQuery<BillDetail>({
    queryKey: ["/api/bills", marchBillId],
    queryFn: async () => {
      const res = await fetch(`/api/bills/${marchBillId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bill");
      return res.json();
    },
    enabled: Boolean(marchBillId) && !marchBillSameAsCurrent,
    ...queryLive,
  });

  const marchBillDetail = marchBillSameAsCurrent ? billDetail : marchBillQ.data;

  /** Stats, donut, members & activity follow latest March bill when it exists; else current month. */
  const statsBillSummary = latestMarchBill ?? currentBillSummary;
  const statsMonthKey = statsBillSummary
    ? accountingMonthKeyFromBillMonth(statsBillSummary.year, statsBillSummary.month)
    : monthKey;
  const statsBillId = statsBillSummary?._id ?? null;
  const statsBillDetail =
    statsBillId == null
      ? null
      : statsBillId === currentBillId
        ? (billDetail ?? null)
        : statsBillId === marchBillId
          ? (marchBillDetail ?? null)
          : null;

  const statsBillLoading =
    Boolean(statsBillId) &&
    (statsBillId === currentBillId ? billDetailLoading : marchBillQ.isLoading);

  const myMarchShare = useMemo(() => {
    if (!marchBillDetail?.payments?.length || !user?._id) return null;
    const id = user._id.toString();
    const row = marchBillDetail.payments.find((p) => uid(p.userId) === id);
    if (!row) return null;
    const total = effectivePaymentDue(row);
    const paid = Number(row.paidAmount) || 0;
    const remaining = Math.max(0, total - paid);
    const bid = latestMarchBill?._id;
    if (!bid) return null;
    return {
      total,
      paid,
      remaining,
      year: marchBillDetail.year,
      billId: bid,
    };
  }, [marchBillDetail, user?._id, latestMarchBill]);

  const lastSyncMsWithBill = Math.max(
    lastSyncMs,
    billQ.dataUpdatedAt,
    marchBillQ.dataUpdatedAt,
  );
  const lastSyncLabel = useMemo(() => {
    if (!lastSyncMsWithBill) return "—";
    try {
      return formatDistanceToNow(new Date(lastSyncMsWithBill), { addSuffix: true });
    } catch {
      return "—";
    }
  }, [lastSyncMsWithBill, syncTick]);

  const monthEntries = useMemo(
    () =>
      entries.filter(
        (e) => entryAccountingMonthKey(e) === statsMonthKey && e.status === "APPROVED",
      ),
    [entries, statsMonthKey],
  );

  const monthPenalties = useMemo(
    () => penalties.filter((p) => penaltyAccountingMonthKey(p) === statsMonthKey),
    [penalties, statsMonthKey],
  );

  const totalEntrySpend = useMemo(
    () => monthEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [monthEntries],
  );

  const totalPenaltyAmount = useMemo(
    () => monthPenalties.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [monthPenalties],
  );

  const payments = statsBillDetail?.payments ?? [];

  const totalPaidOnBill = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0),
    [payments],
  );

  const totalRemainingOnBill = useMemo(
    () =>
      payments.reduce((s, p) => {
        const due = effectivePaymentDue(p);
        const paid = Number(p.paidAmount) || 0;
        return s + Math.max(0, due - paid);
      }, 0),
    [payments],
  );

  const totalDueOnBill = useMemo(
    () => payments.reduce((s, p) => s + effectivePaymentDue(p), 0),
    [payments],
  );

  const totalExpensesDisplay = statsBillSummary
    ? Number(statsBillSummary.totalAmount) || 0
    : totalEntrySpend;

  const donutData: { segments: DonutSeg[]; centerTitle: string; centerSub: string; centerValue: string } =
    useMemo(() => {
      const paid = totalPaidOnBill;
      const out = totalRemainingOnBill;

      if (statsBillSummary && payments.length > 0) {
        const sum = paid + out;
        if (sum < 0.01) {
          return {
            segments: [{ name: "No movement", value: 1, fill: COLORS.neutral }],
            centerTitle: "—",
            centerSub: "Bill",
            centerValue: fmt(Number(statsBillSummary.totalAmount) || 0),
          };
        }
        const pct = Math.round((paid / sum) * 100);
        const segs = [
          { name: "Paid", value: paid, fill: COLORS.paid },
          { name: "Outstanding", value: out, fill: COLORS.outstanding },
        ].filter((s) => s.value > 0.01);
        if (segs.length === 0) {
          return {
            segments: [{ name: "Settled", value: 1, fill: COLORS.neutral }],
            centerTitle: "100%",
            centerSub: "Collected",
            centerValue: fmt(sum),
          };
        }
        return {
          segments: segs,
          centerTitle: `${pct}%`,
          centerSub: "Collected",
          centerValue: fmt(sum),
        };
      }

      const ent = totalEntrySpend;
      const pen = totalPenaltyAmount;
      const t = ent + pen;
      if (t < 0.01) {
        return {
          segments: [{ name: "No data", value: 1, fill: COLORS.neutral }],
          centerTitle: "—",
          centerSub: "No bill yet",
          centerValue: "Add entries",
        };
      }
      const entPct = Math.round((ent / t) * 100);
      const segs = [
        { name: "Approved entries", value: ent, fill: COLORS.entries },
        { name: "Penalties", value: pen, fill: COLORS.penalties },
      ].filter((s) => s.value > 0.01);
      return {
        segments: segs.length ? segs : [{ name: "Total", value: t, fill: COLORS.entries }],
        centerTitle: `${entPct}%`,
        centerSub: "From entries",
        centerValue: fmt(t),
      };
    }, [
      statsBillSummary,
      payments.length,
      totalPaidOnBill,
      totalRemainingOnBill,
      totalEntrySpend,
      totalPenaltyAmount,
    ]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "ACTIVE"),
    [members],
  );

  const memberRows = useMemo(() => {
    const payByUser = new Map<string, PaymentRecord>();
    for (const p of payments) {
      const id = uid(p.userId);
      if (id) payByUser.set(id, p);
    }

    return activeMembers.map((m) => {
      const id = String(m._id);
      let entrySum = 0;
      for (const e of monthEntries) {
        if (uid(e.userId) === id) entrySum += Number(e.amount) || 0;
      }
      let penSum = 0;
      for (const p of monthPenalties) {
        if (uid(p.userId) === id) penSum += Number(p.amount) || 0;
      }
      const pr = payByUser.get(id);
      const paid = pr ? Number(pr.paidAmount) || 0 : 0;
      const due = pr ? effectivePaymentDue(pr) : 0;
      const remaining = pr ? Math.max(0, due - paid) : 0;
      const overpaid = pr && paid > due ? paid - due : 0;

      let netLabel: string;
      let netClass: string;
      let balanceTone: "owe" | "credit" | "none" | "neutral";
      if (!pr) {
        netLabel = "—";
        netClass = "text-white/35";
        balanceTone = "neutral";
      } else if (remaining > 0.01) {
        netLabel = fmt(remaining);
        netClass = "text-red-300 font-bold";
        balanceTone = "owe";
      } else if (overpaid > 0.01) {
        netLabel = `+${fmt(overpaid)}`;
        netClass = "text-emerald-300 font-bold";
        balanceTone = "credit";
      } else {
        netLabel = "✓";
        netClass = "text-emerald-400/90 font-semibold";
        balanceTone = "none";
      }

      return {
        user: m,
        entrySum,
        penSum,
        paid,
        due,
        remaining,
        netLabel,
        netClass,
        balanceTone,
      };
    });
  }, [activeMembers, monthEntries, monthPenalties, payments]);

  const activityFeed = useMemo(() => {
    const items: FeedItem[] = [];

    for (const e of entries) {
      if (entryAccountingMonthKey(e) !== statsMonthKey) continue;
      const t = new Date(e.createdAt || e.dateTime);
      if (Number.isNaN(t.getTime())) continue;
      const who =
        typeof e.userId === "object" && e.userId && "name" in e.userId
          ? String((e.userId as { name?: string }).name)
          : "Member";
      items.push({
        id: `e-${e._id ?? e.dateTime}`,
        ts: t,
        kind: "entry",
        title: e.name || "Entry",
        sub: `${who} · ${e.status}`,
        amount: Number(e.amount) || 0,
        href: "/entries",
      });
    }

    for (const p of monthPenalties) {
      const t = new Date(p.createdAt);
      if (Number.isNaN(t.getTime())) continue;
      const who =
        typeof p.userId === "object" && p.userId && "name" in p.userId
          ? String((p.userId as { name?: string }).name)
          : "Member";
      items.push({
        id: `p-${p._id ?? p.createdAt}`,
        ts: t,
        kind: "penalty",
        title: p.description || p.type || "Penalty",
        sub: who,
        amount: Number(p.amount) || 0,
        href: "/penalties",
      });
    }

    for (const pay of payments) {
      if (!pay.paidAt) continue;
      const t = new Date(pay.paidAt);
      if (Number.isNaN(t.getTime())) continue;
      items.push({
        id: `pay-${pay._id}`,
        ts: t,
        kind: "payment",
        title: "Payment recorded",
        sub: pay.userId?.name ?? "Member",
        amount: Number(pay.paidAmount) || 0,
        href: "/payments",
      });
    }

    items.sort((a, b) => b.ts.getTime() - a.ts.getTime());
    return items.slice(0, 14);
  }, [entries, statsMonthKey, monthPenalties, payments]);

  const summaryLoading =
    entriesLoading || penaltiesLoading || billsLoading || membersLoading;
  const summaryBlockLoading =
    summaryLoading || (Boolean(statsBillId) && statsBillLoading);

  const statsPeriodLabel = statsBillSummary
    ? `${statsBillSummary.month} ${statsBillSummary.year}`
    : format(now, "MMMM yyyy");

  const statSkeleton = (h: string) => (
    <Skeleton className={cn("rounded-xl bg-white/[0.06]", h)} />
  );

  return (
    <div className="space-y-6">
      {/* Hero — slim bar + wide page pills (not a heavy box) */}
      <div className="relative overflow-hidden rounded-2xl border border-[#7c3fbf]/15 bg-gradient-to-r from-[#16122a]/95 via-[#0f0f18] to-[#12101c] p-4 md:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="absolute -right-8 -top-12 h-28 w-28 rounded-full bg-[#7c3fbf]/20 blur-2xl pointer-events-none" />
        <div className="absolute right-[28%] top-2 h-3 w-3 rounded-full bg-emerald-400/25 pointer-events-none" />
        <div className="absolute right-[32%] bottom-3 h-2 w-2 rounded-full bg-[#c49bff]/30 pointer-events-none" />
        <div className="absolute left-[8%] bottom-2 h-4 w-4 rounded-full border border-[#7c3fbf]/20 bg-[#7c3fbf]/5 pointer-events-none" />

        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
          {/* Month block — compact */}
          <div className="min-w-0 shrink-0 lg:max-w-[280px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c49bff]/55 mb-1">
              Accounting month
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl md:text-[1.65rem] font-bold text-white tracking-tight leading-none">
                {monthTitle}
              </h2>
              {monthLockPending ? (
                <Skeleton className="h-6 w-24 rounded-full bg-white/[0.08]" />
              ) : monthLocked ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-200 px-2 py-1 rounded-full bg-amber-500/12 border border-amber-400/25">
                  <FiLock className="w-3 h-3" />
                  Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200 px-2 py-1 rounded-full bg-emerald-500/12 border border-emerald-400/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-indigo-200/45 mt-1.5 leading-snug line-clamp-2">
              Live totals · bill due vs paid · this month only
            </p>
          </div>

          {/* Wide shortcut strip — pills + circles, not a nested card */}
          <div className="min-w-0 flex-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 hidden sm:inline">
                Go to
              </span>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                    anyFetching || billFetching
                      ? "border-[#7c3fbf]/35 bg-[#582c84]/15 text-[#c49bff]"
                      : "border-white/[0.08] bg-white/[0.03] text-indigo-200/65",
                  )}
                >
                  <FiZap className={cn("w-3 h-3 shrink-0", (anyFetching || billFetching) && "animate-pulse")} />
                  <span className="text-[10px] font-medium">
                    {anyFetching || billFetching ? "Syncing…" : `Updated ${lastSyncLabel}`}
                  </span>
                </div>
                {statsBillSummary && (
                  <p className="text-[10px] text-indigo-200/40 tabular-nums hidden md:block">
                    Bill {fmt(Number(statsBillSummary.totalAmount) || 0)} · Due {fmt(totalDueOnBill)}
                  </p>
                )}
              </div>
            </div>

            <div className="relative rounded-xl border border-white/[0.06] bg-black/25 px-2 py-1.5 md:px-3 md:py-2">
              <div
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-[#7c3fbf]/10 blur-xl"
                aria-hidden
              />
              <div className="relative flex flex-wrap items-center gap-1.5 sm:gap-2 z-10">
                <NavPill href="/entries" label="Entries" icon={FiList} />
                <NavPill href="/payments" label="Payments" icon={FiCreditCard} />
                <NavPill href="/penalties" label="Penalties" icon={FiAlertTriangle} />
                <NavPill href="/history" label="History" icon={FiClock} muted />
                {isAdmin && <NavPill href="/manage-users" label="Manage users" icon={FiUsers} />}
              </div>
            </div>
          </div>
        </div>

        {/* Quick row — thin */}
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-black/30 py-1.5 px-2 md:px-2.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300/40 pl-1 pr-0.5">
            Quick
          </span>
          {actionsDisabled ? (
            <button
              type="button"
              disabled
              title={lockTooltip}
              className="h-7 px-3 rounded-lg text-xs font-semibold bg-white/[0.05] text-white/35 border border-white/[0.06] cursor-not-allowed"
            >
              Add entry
            </button>
          ) : (
            <Link
              href="/entries"
              className="inline-flex h-7 items-center justify-center px-3 rounded-lg text-xs font-semibold bg-[#6b3d9e] text-white border border-[#8b5cf6]/25 hover:bg-[#7c4db8] transition-colors"
            >
              Add entry
            </Link>
          )}
          {isAdmin &&
            (actionsDisabled ? (
              <>
                <button
                  type="button"
                  disabled
                  title={lockTooltip}
                  className="h-7 px-3 rounded-lg text-xs font-semibold bg-[#12121c] text-white/30 border border-white/10 cursor-not-allowed"
                >
                  Add payment
                </button>
                <button
                  type="button"
                  disabled
                  title={lockTooltip}
                  className="h-7 px-3 rounded-lg text-xs font-semibold bg-[#12121c] text-white/30 border border-white/10 cursor-not-allowed"
                >
                  Add penalty
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/payments"
                  className="inline-flex h-7 items-center justify-center px-3 rounded-lg text-xs font-semibold bg-[#1a1528] text-indigo-100 border border-[#7c3fbf]/35 hover:bg-[#251d3a] transition-colors"
                >
                  Add payment
                </Link>
                <Link
                  href="/penalties"
                  className="inline-flex h-7 items-center justify-center px-3 rounded-lg text-xs font-semibold bg-[#2c1810] text-amber-100 border border-amber-600/40 hover:bg-[#3d2418] transition-colors"
                >
                  Add penalty
                </Link>
              </>
            ))}
        </div>
      </div>

      {lockDataUnavailable && <MonthLockUnavailableBanner />}
      {!lockDataUnavailable && monthLocked && <MonthLockedBanner />}
      {!lockDataUnavailable && actionsDisabled && gateReason(monthKey) === "loading" && (
        <p className="text-xs text-white/40" role="status">
          Checking month status…
        </p>
      )}

      {latestMarchBill && myMarchShare && (
        <Link
          href={`/payments?billId=${myMarchShare.billId}`}
          className="group relative block touch-manipulation overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[#1a1530] to-[#12121c] p-4 shadow-[0_16px_40px_-20px_rgba(124,63,191,0.45),0_8px_24px_-12px_rgba(0,0,0,0.75)] transition-all hover:border-violet-400/30 hover:shadow-[0_20px_48px_-18px_rgba(124,63,191,0.4)]"
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-violet-500/15 blur-2xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/55">
                  March {myMarchShare.year}
                </p>
                <p className="mt-1 text-base font-semibold text-white md:text-lg">Your bill share</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 ring-1 ring-violet-400/30">
                <FiCreditCard className="h-4 w-4 text-violet-200 md:h-5 md:w-5" />
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-3 md:max-w-md md:shrink-0">
              <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-200/60">Paid</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-100 md:text-xl">
                  {fmt(myMarchShare.paid)}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-rose-200/60">Remaining</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-rose-100 md:text-xl">
                  {fmt(myMarchShare.remaining)}
                </p>
              </div>
            </div>
          </div>

          {myMarchShare.total > 0 && (
            <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06] md:mt-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 to-violet-500/80 transition-all"
                style={{
                  width: `${Math.min(100, Math.round((myMarchShare.paid / myMarchShare.total) * 100))}%`,
                }}
              />
            </div>
          )}

          <div className="relative mt-3 flex items-center justify-between text-[11px] text-indigo-200/55 md:mt-3.5">
            <span className="inline-flex items-center gap-1.5">
              <FiCheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
              {myMarchShare.remaining <= 0 ? "Settled for March" : "Open Payments for this bill"}
            </span>
            <FiArrowUpRight className="h-4 w-4 -rotate-12 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </Link>
      )}

      {/* Bento: metrics + donut */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 grid gap-3 sm:grid-cols-2">
          {summaryBlockLoading ? (
            <>
              {statSkeleton("h-[96px]")}
              {statSkeleton("h-[96px]")}
              {statSkeleton("h-[96px]")}
              {statSkeleton("h-[96px]")}
            </>
          ) : (
            <>
              <SummaryCard
                label="Total expenses"
                value={fmt(totalExpensesDisplay)}
                hint={
                  statsBillSummary
                    ? `Bill total · ${statsBillSummary.month} ${statsBillSummary.year}`
                    : "Approved entries — no bill"
                }
                icon={FiList}
                accent="from-emerald-500/25 to-transparent"
                borderAccent="border-emerald-500/20"
              />
              <SummaryCard
                label="Total payments"
                value={fmt(totalPaidOnBill)}
                hint={
                  statsBillSummary
                    ? `Recorded on ${statsBillSummary.month} bill`
                    : "Create a bill on Payments"
                }
                icon={FiCreditCard}
                accent="from-[#7c3fbf]/35 to-transparent"
                borderAccent="border-[#7c3fbf]/25"
              />
              <SummaryCard
                label="Total penalties"
                value={fmt(totalPenaltyAmount)}
                hint={`Ledger · ${statsPeriodLabel}`}
                icon={FiAlertTriangle}
                accent="from-amber-500/30 to-transparent"
                borderAccent="border-amber-500/25"
              />
              <SummaryCard
                label="Outstanding"
                value={statsBillSummary ? fmt(totalRemainingOnBill) : "—"}
                hint={
                  statsBillSummary
                    ? `Still due on ${statsBillSummary.month} bill`
                    : "No bill for this period"
                }
                icon={FiActivity}
                accent="from-rose-500/25 to-transparent"
                borderAccent="border-rose-500/25"
              />
            </>
          )}
        </div>

        {/* Donut chart card */}
        <div className="xl:col-span-4">
          <div className="h-full min-h-[268px] rounded-2xl border border-white/[0.08] bg-[#111120]/90 overflow-hidden relative flex flex-col">
            <div className="absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-[0.05] pointer-events-none" />
            <div className="relative px-4 pt-4 pb-2 border-b border-white/[0.06]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#c49bff]/75">
                {statsBillSummary ? "Bill snapshot" : "Month snapshot"}
              </p>
              <h3 className="text-base font-semibold text-white mt-0.5">
                {statsBillSummary ? "Collection progress" : "Spend mix"}
              </h3>
              <p className="text-xs text-indigo-200/55 mt-1 leading-snug">
                {statsBillSummary
                  ? `Paid vs outstanding · ${statsBillSummary.month} ${statsBillSummary.year}`
                  : "Approved entries vs penalties (no bill)"}
              </p>
            </div>
            <div className="relative flex-1 flex flex-col items-center justify-center px-3 py-3 min-h-[200px]">
              {summaryBlockLoading ? (
                <Skeleton className="h-40 w-40 rounded-full bg-white/[0.06]" />
              ) : (
                <>
                  <div className="relative w-full max-w-[220px] aspect-square mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData.segments}
                          cx="50%"
                          cy="50%"
                          innerRadius="62%"
                          outerRadius="88%"
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                          animationDuration={600}
                        >
                          {donutData.segments.map((s, i) => (
                            <Cell key={`${s.name}-${i}`} fill={s.fill} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<DonutTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-1">
                      <p className="text-2xl font-bold text-white tabular-nums leading-none">
                        {donutData.centerTitle}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-indigo-200/55 mt-1 font-semibold">
                        {donutData.centerSub}
                      </p>
                      <p className="text-xs text-[#c49bff] mt-1.5 font-semibold tabular-nums">
                        {donutData.centerValue}
                      </p>
                    </div>
                  </div>
                  <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3 text-xs">
                    {donutData.segments.map((s) => (
                      <li key={s.name} className="flex items-center gap-1.5 text-indigo-100/70">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                        <span className="font-medium">{s.name}</span>
                        <span className="text-indigo-200/50 tabular-nums">{fmt(s.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table + activity */}
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 rounded-3xl border border-white/[0.08] bg-[#111120]/85 overflow-hidden shadow-lg shadow-black/20">
          <div className="px-5 py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-[#582c84]/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#7c3fbf]/20 border border-[#7c3fbf]/25">
                <FiUsers className="w-4 h-4 text-[#c49bff]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Members</h3>
                <p className="text-xs text-indigo-200/55 leading-snug">
                  {statsBillSummary
                    ? `Figures for ${statsBillSummary.month} ${statsBillSummary.year} bill`
                    : "Per-person entries, penalties, bill paid & balance"}
                </p>
              </div>
            </div>
            {statsBillLoading && <Skeleton className="h-5 w-20 rounded bg-white/[0.06]" />}
          </div>
          <div className="overflow-x-auto">
            {membersLoading || (Boolean(statsBillId) && statsBillLoading) ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/[0.06]" />
                ))}
              </div>
            ) : memberRows.length === 0 ? (
              <p className="p-10 text-sm text-white/40 text-center">No active members in this flat.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-white/40 border-b border-white/[0.06] bg-black/20">
                    <th className="px-5 py-3.5 font-semibold">Member</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Entries</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Penalties</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Due</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Paid</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((row, idx) => (
                    <tr
                      key={row.user._id}
                      className={cn(
                        "border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors",
                        idx % 2 === 1 && "bg-white/[0.015]",
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-[168px]">
                          <Avatar className="h-10 w-10 ring-2 ring-white/5">
                            <AvatarImage src={row.user.profilePicture} />
                            <AvatarFallback className="bg-gradient-to-br from-[#582c84] to-[#3d1f5c] text-[#c49bff] text-xs font-bold">
                              {initials(row.user.name || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-white truncate">{row.user.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-emerald-300/95">
                        {fmt(row.entrySum)}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-amber-300/95">
                        {fmt(row.penSum)}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-white/70">
                        {row.due > 0 ? fmt(row.due) : "—"}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[#c49bff]/95">
                        {fmt(row.paid)}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3.5 text-right tabular-nums border-l-2",
                          row.balanceTone === "owe" && "border-l-red-500/60 bg-red-500/[0.04]",
                          row.balanceTone === "credit" && "border-l-emerald-500/60 bg-emerald-500/[0.04]",
                          row.balanceTone === "none" && "border-l-emerald-500/30",
                          row.balanceTone === "neutral" && "border-l-transparent",
                        )}
                      >
                        <span className={row.netClass}>{row.netLabel}</span>
                        {row.balanceTone === "owe" && (
                          <span className="block text-[9px] text-red-400/60 uppercase tracking-wide mt-0.5">
                            owes
                          </span>
                        )}
                        {row.balanceTone === "credit" && (
                          <span className="block text-[9px] text-emerald-400/60 uppercase tracking-wide mt-0.5">
                            ahead
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 rounded-3xl border border-white/[0.08] bg-[#111120]/85 flex flex-col min-h-[380px] overflow-hidden shadow-lg shadow-black/20">
          <div className="px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-[#582c84]/10 to-transparent flex items-center gap-2">
            <FiClock className="w-4 h-4 text-[#c49bff]" />
            <div>
              <h3 className="text-base font-semibold text-white">Recent activity</h3>
              <p className="text-[11px] text-white/35">{statsPeriodLabel} · newest first</p>
            </div>
          </div>
          <div className="flex-1 p-3 overflow-y-auto max-h-[520px]">
            {(entriesLoading ||
              penaltiesLoading ||
              (Boolean(statsBillId) && statsBillLoading)) &&
            activityFeed.length === 0 ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl bg-white/[0.06]" />
                ))}
              </div>
            ) : activityFeed.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-3xl mb-2 opacity-30">📋</p>
                <p className="text-sm text-white/45 leading-relaxed">
                  Nothing logged for {statsPeriodLabel} yet. Add an entry or create a bill to see activity
                  here.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {activityFeed.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.05] transition-all border border-transparent hover:border-white/[0.06] group"
                    >
                      <div
                        className={cn(
                          "mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                          item.kind === "entry" && "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
                          item.kind === "payment" && "bg-[#7c3fbf]/15 border-[#7c3fbf]/30 text-[#c49bff]",
                          item.kind === "penalty" && "bg-amber-500/10 border-amber-500/25 text-amber-400",
                        )}
                      >
                        {item.kind === "entry" && <FiList className="w-4 h-4" />}
                        {item.kind === "payment" && <FiCreditCard className="w-4 h-4" />}
                        {item.kind === "penalty" && <FiAlertTriangle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/95 truncate group-hover:text-white">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-white/38 mt-0.5">{item.sub}</p>
                        <p className="text-[10px] text-white/22 mt-1 tabular-nums">
                          {format(item.ts, "EEE d MMM · h:mm a")}
                        </p>
                      </div>
                      {item.amount != null && (
                        <span
                          className={cn(
                            "text-sm font-bold shrink-0 tabular-nums",
                            item.kind === "entry" && "text-emerald-400",
                            item.kind === "payment" && "text-[#c49bff]",
                            item.kind === "penalty" && "text-amber-400",
                          )}
                        >
                          {fmt(item.amount)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  borderAccent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof FiList;
  accent: string;
  borderAccent: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-[#13131c] transition-all duration-200 hover:border-white/15 hover:shadow-md hover:shadow-black/30",
        borderAccent,
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.85] pointer-events-none", accent)} />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-[0.035]" />
      <div className="relative px-3.5 pt-3 pb-3 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-100/75">{label}</p>
          <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-indigo-100/90">
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className="text-xl font-bold text-white mt-2 tabular-nums tracking-tight leading-none">
          {value}
        </p>
        <p className="text-xs text-indigo-100/70 mt-2 leading-relaxed font-medium">{hint}</p>
      </div>
    </div>
  );
}

/** Compact pill for horizontal shortcut strip (wide layout, circular icon). */
function NavPill({
  href,
  label,
  icon: Icon,
  muted,
}: {
  href: string;
  label: string;
  icon: typeof FiList;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] pl-1 pr-2.5 py-1",
        "hover:border-[#7c3fbf]/40 hover:bg-[#582c84]/15 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3fbf]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f18]",
        muted && "opacity-80 hover:opacity-100",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          "bg-gradient-to-br from-[#7c3fbf]/55 to-[#4c1d95]/50 border border-white/15 shadow-sm shadow-black/30",
          "group-hover:from-[#8b5cf6]/65 group-hover:to-[#582c84]/55 transition-colors",
        )}
      >
        <Icon className="w-3 h-3 text-white/95" aria-hidden />
      </span>
      <span className="text-[11px] font-semibold text-indigo-100/90 whitespace-nowrap group-hover:text-white">
        {label}
      </span>
      <FiArrowUpRight
        className="w-3 h-3 shrink-0 text-white/20 transition-transform duration-200 group-hover:text-[#c49bff] group-hover:translate-x-px group-hover:-translate-y-px"
        aria-hidden
      />
    </Link>
  );
}
