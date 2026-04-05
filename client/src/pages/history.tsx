import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { apiRequest } from "@/lib/queryClient";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import {
  format,
  startOfMonth, endOfMonth, isWithinInterval, isToday, isYesterday,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  FiArrowLeft, FiChevronLeft, FiChevronRight, FiChevronDown,
  FiList, FiAlertTriangle, FiCheckCircle, FiXCircle, FiClock,
  FiBarChart2, FiUsers,
} from "react-icons/fi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PENALTY_LABELS: Record<string, string> = {
  LATE_PAYMENT: "Late Payment",
  DAMAGE: "Damage",
  RULE_VIOLATION: "Rule Violation",
  MINIMUM_ENTRY: "Min Entry",
  OTHER: "Other",
};

function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function entryStatusBadge(status: string) {
  if (status === "APPROVED") return { cls: "text-emerald-400 bg-emerald-500/15", Icon: FiCheckCircle };
  if (status === "REJECTED") return { cls: "text-red-400 bg-red-500/15", Icon: FiXCircle };
  return { cls: "text-amber-400 bg-amber-500/15", Icon: FiClock };
}

function inMonth(dateStr: string, start: Date, end: Date) {
  try { return isWithinInterval(new Date(dateStr), { start, end }); }
  catch { return false; }
}

function dateLabel(d: Date) {
  if (isToday(d))     return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM, EEEE");
}

function dedupeLedgerById<T extends { _id?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const id = r._id != null ? String(r._id) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

// ─── Custom Chart Tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const total = (d?.entries ?? 0) + (d?.penalties ?? 0);
  return (
    <div className="bg-[#1a1a2e] border border-[#7c3fbf]/40 rounded-xl px-3.5 py-3 shadow-2xl text-xs pointer-events-none min-w-[140px]">
      <p className="text-white/90 font-bold mb-2 text-[11px] truncate">{d?.fullName}</p>
      <div className="space-y-1.5">
        {(d?.entries ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#c49bff]/60">Entries</span>
            <span className="text-[#c49bff] font-bold">₹{d.entries.toLocaleString("en-IN")}</span>
          </div>
        )}
        {(d?.penalties ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-amber-400/60">Penalties</span>
            <span className="text-amber-400 font-bold">₹{d.penalties.toLocaleString("en-IN")}</span>
          </div>
        )}
        {(d?.entries ?? 0) > 0 && (d?.penalties ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] pt-1.5 mt-1">
            <span className="text-white/35">Total</span>
            <span className="text-white/70 font-bold">₹{total.toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>
      <p className="text-[9px] text-[#c49bff]/30 mt-2 text-center hidden md:block">click for details</p>
      <p className="text-[9px] text-[#c49bff]/30 mt-2 text-center md:hidden">tap for details</p>
    </div>
  );
}

// ─── User Stat type ───────────────────────────────────────────────────────────

interface UserStat {
  userId: string;
  name: string;
  avatar?: string;
  entryCount: number;
  entryAmount: number;
  penaltyCount: number;
  penaltyAmount: number;
  /** Present when this row was filled from a saved monthly snapshot (no live entries/penalties in /api/history for that user+month). */
  fromMonthlySnapshot?: boolean;
}

function normalizeUserId(uid: unknown): string {
  if (uid == null || uid === "") return "";
  if (typeof uid === "object" && uid !== null && "_id" in (uid as object)) {
    const id = (uid as { _id?: unknown })._id;
    return id != null ? String(id) : "";
  }
  return String(uid);
}

/** Canonical YYYY-MM for "today" (local), same idea as server accounting month. */
function currentAccountingMonthKey(ref = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}

function derivedMonthKeyFromRecord(r: { year: number; monthIndex: number }): string | null {
  const y = Number(r.year);
  const mi = Number(r.monthIndex);
  if (!Number.isFinite(y) || !Number.isFinite(mi)) return null;
  if (mi >= 0 && mi <= 11) return `${y}-${String(mi + 1).padStart(2, "0")}`;
  return null;
}

type MonthlyHistoryRow = {
  _id?: string;
  year: number;
  monthIndex: number;
  month?: string;
  members?: unknown[];
  grandTotal?: number;
  lifecycleStatus?: string;
  isDeleted?: boolean;
  accountingMonth?: string;
};

/**
 * History shows only finalized periods: never the live calendar month, never "active" snapshots.
 * Legacy rows: past month + missing lifecycle still shown (treated as final).
 */
function isClosedHistoryRecord(r: MonthlyHistoryRow, ref = new Date()): boolean {
  if (r.isDeleted === true) return false;
  const curKey = currentAccountingMonthKey(ref);
  const am = typeof r.accountingMonth === "string" ? r.accountingMonth.trim() : "";
  const key = (am && /^\d{4}-\d{2}$/.test(am) ? am : null) ?? derivedMonthKeyFromRecord(r);
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return false;
  if (key >= curKey) return false;

  if (r.lifecycleStatus === "archived") return true;
  if (r.lifecycleStatus === "active") return false;
  return true;
}

function findMonthlyHistoryForMonth(records: MonthlyHistoryRow[], d: Date): MonthlyHistoryRow | null {
  const y = d.getFullYear();
  const month0 = d.getMonth();
  const idx0 = month0;
  const idx1 = month0 + 1;
  return (
    records.find((r) => r.year === y && r.monthIndex === idx0) ??
    records.find((r) => r.year === y && r.monthIndex === idx1) ??
    null
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"all" | "entry" | "penalty">("all");
  const [entryStatusFilter, setEntryStatusFilter] = useState<string>("all");
  const [penaltyTypeFilter, setPenaltyTypeFilter] = useState<string>("all");
  const [showPicker, setShowPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const monthStart     = startOfMonth(currentDate);
  const monthEnd       = endOfMonth(currentDate);

  // ── Query — unified history from dedicated endpoint ─────────────────────
  const { data: historyData, isLoading } = useQuery<{ entries: any[]; penalties: any[] }>({
    queryKey: ["/api/history"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/history");
      return r.ok ? r.json() : { entries: [], penalties: [] };
    },
  });

  const entries   = useMemo(
    () => dedupeLedgerById(historyData?.entries ?? []),
    [historyData?.entries]
  );
  const penalties = useMemo(
    () => dedupeLedgerById(historyData?.penalties ?? []),
    [historyData?.penalties]
  );

  // ── Monthly history summaries (seeded past months) ──────────────────
  const { data: monthlyHistories = [] } = useQuery<any[]>({
    queryKey: ["/api/monthly-history"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/monthly-history");
      return r.ok ? r.json() : [];
    },
  });

  const closedMonthlyHistories = useMemo(() => {
    const ref = new Date();
    return (monthlyHistories as MonthlyHistoryRow[]).filter((r) =>
      isClosedHistoryRecord(r, ref),
    );
  }, [monthlyHistories]);

  useEffect(() => { showLoader(); return () => forceHideLoader(); }, []);
  useEffect(() => { if (!isLoading) setTimeout(() => hideLoader(), 200); }, [isLoading]);

  // ── Filter by selected month ──────────────────────────────────────────────
  const filteredEntries = useMemo(
    () => entries.filter(e => inMonth(e.dateTime, monthStart, monthEnd)),
    [entries, monthStart, monthEnd]
  );
  const filteredPenalties = useMemo(
    () => penalties.filter(p => inMonth(p.createdAt, monthStart, monthEnd)),
    [penalties, monthStart, monthEnd]
  );

  // Saved snapshot for the visible month — only from closed (archived / finalized) history rows
  const monthlyHistoryRecord = useMemo(
    () => findMonthlyHistoryForMonth(closedMonthlyHistories, currentDate),
    [closedMonthlyHistories, currentDate],
  );

  /** Closed monthly snapshot for this period (live calendar month is never listed here). */
  const hasMonthlySnapshot = monthlyHistoryRecord !== null;

  // ── Per-user aggregated stats ─────────────────────────────────────────────
  const userStats: UserStat[] = useMemo(() => {
    if (!monthlyHistoryRecord) return [];

    const map = new Map<string, UserStat>();

    filteredEntries.forEach((e: any) => {
      const uid = normalizeUserId(e.userId);
      if (!uid) return;
      const name = typeof e.userId === "object" && e.userId ? e.userId.name : "Unknown";
      const av =
        typeof e.userId === "object" && e.userId ? e.userId.profilePicture : undefined;
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          name,
          avatar: av,
          entryCount: 0,
          entryAmount: 0,
          penaltyCount: 0,
          penaltyAmount: 0,
        });
      }
      const s = map.get(uid)!;
      s.entryCount++;
      s.entryAmount += e.amount ?? 0;
    });

    filteredPenalties.forEach((p: any) => {
      const uid = normalizeUserId(p.userId);
      if (!uid) return;
      const name = typeof p.userId === "object" && p.userId ? p.userId.name : "Unknown";
      const av =
        typeof p.userId === "object" && p.userId ? p.userId.profilePicture : undefined;
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          name,
          avatar: av,
          entryCount: 0,
          entryAmount: 0,
          penaltyCount: 0,
          penaltyAmount: 0,
        });
      }
      const s = map.get(uid)!;
      s.penaltyCount++;
      s.penaltyAmount += p.amount ?? 0;
    });

    // MonthlyHistory snapshot is authoritative for the selected month (live ledger may be empty after purge).
    // Merge into existing users too — otherwise members already in the map from /api/history with 0 totals
    // (e.g. Vikas/Vishal after archived rows were deleted) never get snapshot amounts.
    if (monthlyHistoryRecord?.members?.length) {
      for (const m of monthlyHistoryRecord.members as Array<{
        name?: string;
        userId?: unknown;
        entryAmount?: number;
        penaltyAmount?: number;
      }>) {
        const uid = normalizeUserId(m.userId);
        if (!uid) continue;
        const entryAmt = Number(m.entryAmount) || 0;
        const penAmt = Number(m.penaltyAmount) || 0;
        if (entryAmt === 0 && penAmt === 0) continue;

        const existing = map.get(uid);
        if (!existing) {
          map.set(uid, {
            userId: uid,
            name: m.name || "Member",
            avatar: undefined,
            entryCount: entryAmt > 0 ? 1 : 0,
            entryAmount: entryAmt,
            penaltyCount: penAmt > 0 ? 1 : 0,
            penaltyAmount: penAmt,
            fromMonthlySnapshot: true,
          });
        } else {
          existing.entryAmount = entryAmt;
          existing.penaltyAmount = penAmt;
          existing.entryCount =
            entryAmt > 0 ? Math.max(existing.entryCount, 1) : existing.entryCount;
          existing.penaltyCount =
            penAmt > 0 ? Math.max(existing.penaltyCount, 1) : existing.penaltyCount;
          existing.fromMonthlySnapshot = true;
          if (m.name && (existing.name === "Unknown" || !existing.name.trim())) {
            existing.name = m.name;
          }
        }
      }
    }

    return Array.from(map.values())
      .filter(
        s =>
          s.entryCount > 0 ||
          s.penaltyCount > 0 ||
          s.entryAmount > 0 ||
          s.penaltyAmount > 0
      )
      .sort((a, b) => b.entryAmount - a.entryAmount);
  }, [filteredEntries, filteredPenalties, monthlyHistoryRecord]);

  // Totals from live ledger rows (may be 0 after month-close purge).
  const totalEntryAmt   = filteredEntries.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalPenaltyAmt = filteredPenalties.reduce((s, p) => s + (p.amount ?? 0), 0);

  const userStatsEntrySum = useMemo(
    () => userStats.reduce((s, u) => s + u.entryAmount, 0),
    [userStats]
  );
  const userStatsPenaltySum = useMemo(
    () => userStats.reduce((s, u) => s + u.penaltyAmount, 0),
    [userStats]
  );

  // userStats merges MonthlyHistory snapshot; use max so summary + share % match the member list after purge.
  const displayTotalEntryAmt = hasMonthlySnapshot
    ? Math.max(totalEntryAmt, userStatsEntrySum)
    : 0;
  const displayTotalPenaltyAmt = hasMonthlySnapshot
    ? Math.max(totalPenaltyAmt, userStatsPenaltySum)
    : 0;

  // Chart data (live)
  const chartData = useMemo(() =>
    userStats.map(s => ({
      name:      s.name.split(" ")[0],
      fullName:  s.name,
      userId:    s.userId,
      entries:   s.entryAmount,
      penalties: s.penaltyAmount,
    })),
    [userStats]
  );

  // ── Selected user detail ──────────────────────────────────────────────────
  const selectedUser = userStats.find(
    s => String(s.userId) === String(selectedUserId)
  );

  /** Snapshot row for the selected user (when live ledger rows are missing for this month). */
  const snapshotRowForSelectedUser = useMemo(() => {
    if (!monthlyHistoryRecord || !selectedUserId) return null;
    const mem = (monthlyHistoryRecord.members as any[]).find(
      (m: any) => normalizeUserId(m.userId) === String(selectedUserId)
    );
    return mem ?? null;
  }, [monthlyHistoryRecord, selectedUserId]);

  const userEntries = useMemo(
    () =>
      !selectedUserId
        ? []
        : filteredEntries
            .filter((e: any) => normalizeUserId(e.userId) === String(selectedUserId))
            .sort(
              (a: any, b: any) =>
                new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
            ),
    [filteredEntries, selectedUserId]
  );

  const userPenalties = useMemo(
    () =>
      !selectedUserId
        ? []
        : filteredPenalties
            .filter((p: any) => normalizeUserId(p.userId) === String(selectedUserId))
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
    [filteredPenalties, selectedUserId]
  );

  // Merge + group by date
  const timeline = useMemo(() => {
    type Item = { kind: "entry" | "penalty"; date: Date; data: any };
    const all: Item[] = [
      ...userEntries.map(e   => ({ kind: "entry"   as const, date: new Date(e.dateTime),  data: e })),
      ...userPenalties.map(p => ({ kind: "penalty" as const, date: new Date(p.createdAt), data: p })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const grouped: Record<string, Item[]> = {};
    all.forEach(item => {
      const key = format(item.date, "yyyy-MM-dd");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [userEntries, userPenalties]);

  // ── Filtered detail lists ───────────────────────────────────────────────────
  const filteredDetailEntries = useMemo(() =>
    entryStatusFilter === "all" ? userEntries : userEntries.filter((e: any) => e.status === entryStatusFilter),
    [userEntries, entryStatusFilter]
  );
  const filteredDetailPenalties = useMemo(() =>
    penaltyTypeFilter === "all" ? userPenalties : userPenalties.filter((p: any) => p.type === penaltyTypeFilter),
    [userPenalties, penaltyTypeFilter]
  );

  // ── Active timeline based on selected tab ────────────────────────────────
  const activeTimeline = useMemo(() => {
    type Item = { kind: "entry" | "penalty"; date: Date; data: any };
    if (detailTab === "all") return timeline;
    const items: Item[] = detailTab === "entry"
      ? filteredDetailEntries.map(e => ({ kind: "entry" as const, date: new Date(e.dateTime), data: e }))
      : filteredDetailPenalties.map((p: any) => ({ kind: "penalty" as const, date: new Date(p.createdAt), data: p }));
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    const grouped: Record<string, Item[]> = {};
    items.forEach(item => {
      const key = format(item.date, "yyyy-MM-dd");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [detailTab, filteredDetailEntries, filteredDetailPenalties, timeline]);

  // ── Month nav handler (closed months only, newest first) ──────────────────
  function resetDetail() { setDetailTab("all"); setEntryStatusFilter("all"); setPenaltyTypeFilter("all"); }

  /** Closed months for picker / arrows — newest first (index 0 = most recent closed). */
  const pickerMonths = useMemo(() => {
    type Row = { year: number; month: number; sortKey: string };
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (const r of closedMonthlyHistories) {
      const am = typeof r.accountingMonth === "string" ? r.accountingMonth.trim() : "";
      const key =
        am && /^\d{4}-\d{2}$/.test(am) ? am : derivedMonthKeyFromRecord(r);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const mi = Number(r.monthIndex);
      const calMonth = mi >= 0 && mi <= 11 ? mi : Math.max(0, Math.min(11, mi - 1));
      rows.push({ year: Number(r.year), month: calMonth, sortKey: key });
    }
    rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return rows.map(({ year, month }) => ({ year, month }));
  }, [closedMonthlyHistories]);

  const currentPickerIndex = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    return pickerMonths.findIndex((pm) => pm.year === y && pm.month === m);
  }, [currentDate, pickerMonths]);

  useEffect(() => {
    if (pickerMonths.length === 0) return;
    setCurrentDate((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      if (pickerMonths.some((pm) => pm.year === y && pm.month === m)) return prev;
      const latest = pickerMonths[0]!;
      return new Date(latest.year, latest.month, 1);
    });
  }, [pickerMonths]);

  function prevMonth() {
    if (currentPickerIndex < 0 || currentPickerIndex >= pickerMonths.length - 1) return;
    const t = pickerMonths[currentPickerIndex + 1]!;
    setCurrentDate(new Date(t.year, t.month, 1));
    setSelectedUserId(null);
    resetDetail();
  }
  function nextMonth() {
    if (currentPickerIndex <= 0) return;
    const t = pickerMonths[currentPickerIndex - 1]!;
    setCurrentDate(new Date(t.year, t.month, 1));
    setSelectedUserId(null);
    resetDetail();
  }
  function jumpToMonth(year: number, month: number) {
    if (!pickerMonths.some((pm) => pm.year === year && pm.month === month)) return;
    setCurrentDate(new Date(year, month, 1));
    setSelectedUserId(null);
    resetDetail();
    setShowPicker(false);
  }
  function jumpToYear(year: number) {
    const inYear = pickerMonths.filter((m) => m.year === year);
    if (inYear.length === 0) return;
    const t = inYear[0]!;
    setCurrentDate(new Date(t.year, t.month, 1));
    setSelectedUserId(null);
    resetDetail();
    setShowYearPicker(false);
  }

  const availableYears = useMemo(
    () => Array.from(new Set(pickerMonths.map((m) => m.year))).sort((a, b) => b - a),
    [pickerMonths],
  );

  const canGoOlder =
    pickerMonths.length > 0 &&
    currentPickerIndex >= 0 &&
    currentPickerIndex < pickerMonths.length - 1;
  const canGoNewer = pickerMonths.length > 0 && currentPickerIndex > 0;

  // true when showing seeded summary (no live data for this month)
  const isHistoricalSummary = userStats.length === 0 && monthlyHistoryRecord !== null;

  // Chart data (historical — from seeded MonthlyHistory record)
  const historicalChartData = useMemo(() => {
    if (!monthlyHistoryRecord) return [];
    return (monthlyHistoryRecord.members as any[]).map((m: any) => ({
      name:      (m.name as string).split(" ")[0],
      fullName:  m.name as string,
      userId:    String(m.userId),
      entries:   m.entryAmount as number,
      penalties: m.penaltyAmount as number,
    }));
  }, [monthlyHistoryRecord]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f0f1f] relative">
      <Header />

      <div
        className="hidden md:block pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-[#0f0f1f]" />
        <div className="absolute bottom-0 right-0 w-[70%] h-[40vh] bg-gradient-to-tl from-indigo-500/10 to-purple-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 pt-24 pb-28 sm:pb-10 px-3 sm:px-6 lg:px-8 max-w-xl sm:max-w-4xl md:max-w-7xl mx-auto md:pl-[272px]">

        <p className="md:hidden text-[11px] text-white/40 mb-4 px-1 leading-relaxed">
          <span className="text-white/55 font-semibold">History</span> — finalized closed months only. The current month stays on{" "}
          <span className="text-white/50">Entries</span> and <span className="text-white/50">Payments</span> until the period is closed.
        </p>
        <div className="hidden md:block mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">History</h1>
          <p className="text-indigo-200/75 mt-2 text-sm max-w-2xl leading-relaxed">
            Finalized closed months only—read-only ledger archive. The current period stays on{" "}
            <span className="text-indigo-100/90">Entries</span> and{" "}
            <span className="text-indigo-100/90">Payments</span> until month close.
          </p>
        </div>

        {selectedUserId ? (
          <div className="lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">
            <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-28">
            {/* User header */}
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => { setSelectedUserId(null); resetDetail(); }}
                className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
              >
                <FiArrowLeft className="w-4 h-4 text-white/70" />
              </button>
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedUser?.avatar} />
                <AvatarFallback className="bg-[#582c84]/30 text-[#c49bff] text-xs font-bold">
                  {getInitials(selectedUser?.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-bold text-white leading-tight">{selectedUser?.name ?? "Member"}</p>
                <p className="text-xs text-white/35">{format(currentDate, "MMMM yyyy")}</p>
              </div>
            </div>

            {/* User stat chips */}
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 mb-5 lg:mb-0">
              {[
                {
                  label: "Entries",
                  value: selectedUser?.entryCount ?? 0,
                  sub:   `₹${(selectedUser?.entryAmount ?? 0).toLocaleString("en-IN")} spent`,
                  cls:  "border-emerald-500/20 bg-emerald-500/[0.06]",
                  vcls: "text-emerald-400",
                },
                {
                  label: "Total Amount",
                  value: `₹${(selectedUser?.entryAmount ?? 0).toLocaleString("en-IN")}`,
                  sub:   "this month",
                  cls:  "border-[#7c3fbf]/25 bg-[#7c3fbf]/[0.07]",
                  vcls: "text-[#c49bff]",
                },
                {
                  label: "Penalties",
                  value: selectedUser?.penaltyCount ?? 0,
                  sub:   `₹${(selectedUser?.penaltyAmount ?? 0).toLocaleString("en-IN")}`,
                  cls:  "border-amber-500/20 bg-amber-500/[0.06]",
                  vcls: "text-amber-400",
                },
              ].map(s => (
                <div key={s.label} className={cn("rounded-xl border px-2 py-3 text-center lg:text-left lg:px-4 lg:py-3.5", s.cls)}>
                  <p className={cn("text-xl font-bold leading-none", s.vcls)}>{s.value}</p>
                  <p className="text-[8px] text-white/35 mt-1 uppercase tracking-wider leading-tight">{s.label}</p>
                  <p className="text-[9px] text-white/25 mt-0.5 leading-tight">{s.sub}</p>
                </div>
              ))}
            </div>
            </div>

            <div className="lg:col-span-8 min-w-0 space-y-4">
            {/* ── Tabs ── */}
            <div className="flex items-center gap-1.5 mb-3">
              {([
                { key: "all",     label: "All",       count: userEntries.length + userPenalties.length },
                { key: "entry",   label: "Entries",   count: userEntries.length },
                { key: "penalty", label: "Penalties", count: userPenalties.length },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setDetailTab(tab.key); setEntryStatusFilter("all"); setPenaltyTypeFilter("all"); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    detailTab === tab.key
                      ? tab.key === "entry"   ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : tab.key === "penalty" ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                        : "bg-[#7c3fbf]/20 border-[#7c3fbf]/50 text-[#c49bff]"
                      : "bg-white/[0.04] border-white/[0.07] text-white/35 hover:text-white/60"
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                    detailTab === tab.key ? "bg-white/20" : "bg-white/[0.07] text-white/30"
                  )}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* ── Entry status filter chips ── */}
            {detailTab === "entry" && (
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {(["all", "APPROVED", "PENDING", "REJECTED"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setEntryStatusFilter(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all",
                      entryStatusFilter === s
                        ? s === "APPROVED" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : s === "REJECTED" ? "bg-red-500/15 border-red-500/40 text-red-400"
                          : s === "PENDING"  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                          : "bg-[#7c3fbf]/20 border-[#7c3fbf]/50 text-[#c49bff]"
                        : "bg-white/[0.04] border-white/[0.07] text-white/35 hover:text-white/55"
                    )}
                  >
                    {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            )}

            {/* ── Penalty type filter chips ── */}
            {detailTab === "penalty" && (
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {(["all", "LATE_PAYMENT", "DAMAGE", "RULE_VIOLATION", "MINIMUM_ENTRY", "OTHER"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setPenaltyTypeFilter(t)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all",
                      penaltyTypeFilter === t
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                        : "bg-white/[0.04] border-white/[0.07] text-white/35 hover:text-white/55"
                    )}
                  >
                    {t === "all" ? "All Types" : PENALTY_LABELS[t]}
                  </button>
                ))}
              </div>
            )}

            {/* ── Timeline ── */}
            {activeTimeline.length === 0 ? (
              snapshotRowForSelectedUser &&
              userEntries.length === 0 &&
              userPenalties.length === 0 ? (
                <div className="bg-[#111120] border border-[#7c3fbf]/25 rounded-2xl px-4 py-5 space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-[#c49bff]/70 font-semibold">
                    Saved monthly summary
                  </p>
                  <p className="text-xs text-white/45 leading-relaxed">
                    Individual entries and penalties for this month are not in the live ledger (e.g. archived period). Totals below come from the saved snapshot for this member.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <p className="text-[9px] text-emerald-400/70 uppercase">Entries</p>
                      <p className="font-bold text-emerald-400">
                        ₹{Number(snapshotRowForSelectedUser.entryAmount ?? 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                      <p className="text-[9px] text-amber-400/70 uppercase">Penalties</p>
                      <p className="font-bold text-amber-400">
                        ₹{Number(snapshotRowForSelectedUser.penaltyAmount ?? 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-white/50 pt-1">
                    Net:{" "}
                    <span className="font-bold text-white">
                      ₹
                      {(
                        Number(snapshotRowForSelectedUser.entryAmount ?? 0) -
                        Number(snapshotRowForSelectedUser.penaltyAmount ?? 0)
                      ).toLocaleString("en-IN")}
                    </span>
                  </p>
                </div>
              ) : (
              <div className="py-14 flex flex-col items-center gap-2 text-center">
                <p className="text-4xl">📭</p>
                <p className="text-white/40 text-sm">
                  {entryStatusFilter !== "all" || penaltyTypeFilter !== "all"
                    ? "No records matching this filter"
                    : `No ${detailTab === "entry" ? "entries" : detailTab === "penalty" ? "penalties" : "activity"} in ${format(currentDate, "MMMM yyyy")}`
                  }
                </p>
              </div>
              )
            ) : (
              <div className="space-y-4">
                {activeTimeline.map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-white/25 mb-2 px-1">
                      {dateLabel(new Date(dateKey))}
                      <span className="ml-2 text-white/15 normal-case tracking-normal">
                        {format(new Date(dateKey), "d MMM")}
                      </span>
                    </p>
                    <div className="bg-[#111120] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                      {items.map((item) => {
                        const rowKey = `${item.kind}-${String(item.data._id ?? item.date.getTime())}`;
                        const isEntry = item.kind === "entry";
                        const badge   = isEntry ? entryStatusBadge(item.data.status) : null;
                        return (
                          <div key={rowKey} className="flex items-center gap-3 px-4 py-3.5">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              isEntry ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"
                            )}>
                              {isEntry
                                ? <FiList className="w-3.5 h-3.5 text-emerald-400" />
                                : <FiAlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {isEntry ? item.data.name : item.data.description}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isEntry && badge ? (
                                  <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded", badge.cls)}>
                                    <badge.Icon className="w-2.5 h-2.5" />
                                    {item.data.status.charAt(0) + item.data.status.slice(1).toLowerCase()}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/15">
                                    {PENALTY_LABELS[item.data.type] ?? item.data.type}
                                  </span>
                                )}
                                <span className="text-[10px] text-white/25">{format(item.date, "hh:mm a")}</span>
                              </div>
                            </div>
                            <p className={cn("text-sm font-bold shrink-0", isEntry ? "text-emerald-400" : "text-amber-400")}>
                              ₹{(item.data.amount ?? 0).toLocaleString("en-IN")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

        ) : (
          /* ═══ OVERVIEW ════════════════════════════════════════════════════ */
          <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
            <aside className="lg:col-span-4 mb-5 lg:mb-0">
              <div className="lg:rounded-2xl lg:border lg:border-[#7c3fbf]/25 lg:bg-gradient-to-b lg:from-[#1a1530]/90 lg:to-[#111018]/95 lg:p-6 lg:shadow-[0_0_40px_rgba(101,58,167,0.08)] lg:sticky lg:top-28 space-y-4">
                <p className="hidden lg:block text-[10px] uppercase tracking-widest text-white/35 font-semibold">Closed period</p>
                {/* ── Filter Bar ── */}
                <div className="flex items-center justify-between px-1 lg:px-0">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => { setShowYearPicker(v => !v); setShowPicker(false); }}
                        className={cn(
                          "flex items-center gap-1 h-8 px-3 rounded-lg border text-xs font-bold transition-all",
                          showYearPicker
                            ? "bg-[#582c84]/40 border-[#7c3fbf]/60 text-[#c49bff]"
                            : "bg-[#7c3fbf]/10 border-[#7c3fbf]/20 text-[#c49bff]/70 hover:bg-[#7c3fbf]/20 hover:text-[#c49bff]"
                        )}
                      >
                        {currentDate.getFullYear()}
                        <FiChevronDown className={cn("w-3 h-3 transition-transform duration-200", showYearPicker && "rotate-180")} />
                      </button>
                      {showYearPicker && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowYearPicker(false)} />
                          <div className="absolute top-full left-0 mt-1.5 z-50 bg-[#16162a] border border-[#7c3fbf]/30 rounded-xl shadow-2xl overflow-hidden min-w-[84px]">
                            {availableYears.map(yr => (
                              <button
                                key={yr}
                                onClick={() => jumpToYear(yr)}
                                className={cn(
                                  "w-full px-4 py-2.5 text-sm text-left font-semibold transition-colors",
                                  currentDate.getFullYear() === yr
                                    ? "bg-[#582c84]/40 text-[#c49bff]"
                                    : "text-white/50 hover:bg-[#7c3fbf]/10 hover:text-[#c49bff]/80"
                                )}
                              >
                                {yr}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => { setShowPicker(v => !v); setShowYearPicker(false); }}
                        className={cn(
                          "flex items-center gap-1 h-8 px-3 rounded-lg border text-xs font-bold transition-all",
                          showPicker
                            ? "bg-[#582c84]/40 border-[#7c3fbf]/60 text-[#c49bff]"
                            : "bg-[#7c3fbf]/10 border-[#7c3fbf]/20 text-[#c49bff]/70 hover:bg-[#7c3fbf]/20 hover:text-[#c49bff]"
                        )}
                      >
                        {format(currentDate, "MMM")}
                        <FiChevronDown className={cn("w-3 h-3 transition-transform duration-200", showPicker && "rotate-180")} />
                      </button>
                      {showPicker && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                          <div className="absolute top-full left-0 mt-1.5 z-50 bg-[#16162a] border border-[#7c3fbf]/30 rounded-xl shadow-2xl overflow-hidden w-36">
                            <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
                              {pickerMonths.filter(m => m.year === currentDate.getFullYear()).map(({ year, month }) => {
                                const isSel = currentDate.getMonth() === month;
                                return (
                                  <button
                                    key={`${year}-${month}`}
                                    onClick={() => jumpToMonth(year, month)}
                                    className={cn(
                                      "w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors",
                                      isSel
                                        ? "bg-[#582c84]/40 text-[#c49bff]"
                                        : "text-white/50 hover:bg-[#7c3fbf]/10 hover:text-[#c49bff]/80"
                                    )}
                                  >
                                    <span>{format(new Date(year, month, 1), "MMM")}</span>
                                    {isSel && <span className="w-1.5 h-1.5 rounded-full bg-[#c49bff] shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={prevMonth}
                      disabled={!canGoOlder}
                      title="Older closed month"
                      className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center transition-all",
                        !canGoOlder
                          ? "opacity-20 cursor-not-allowed bg-white/[0.03] border-white/[0.05]"
                          : "bg-[#7c3fbf]/10 hover:bg-[#7c3fbf]/25 border border-[#7c3fbf]/20 hover:border-[#7c3fbf]/40",
                      )}
                    >
                      <FiChevronLeft className="w-4 h-4 text-[#c49bff]/70" />
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      disabled={!canGoNewer}
                      title="Newer closed month"
                      className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center transition-all",
                        !canGoNewer
                          ? "opacity-20 cursor-not-allowed bg-white/[0.03] border-white/[0.05]"
                          : "bg-[#7c3fbf]/10 hover:bg-[#7c3fbf]/25 border border-[#7c3fbf]/20 hover:border-[#7c3fbf]/40",
                      )}
                    >
                      <FiChevronRight className="w-4 h-4 text-[#c49bff]/70" />
                    </button>
                  </div>
                </div>
                {!showPicker && !showYearPicker && (
                  <div className="flex flex-wrap items-center gap-2 px-1 lg:px-0">
                    <h2 className="text-lg lg:text-xl font-bold text-white tracking-tight">
                      {format(currentDate, "MMMM yyyy")}
                    </h2>
                    {pickerMonths.length > 0 && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-500/20 border border-slate-500/35 text-slate-300/90">
                        Closed period · Read-only
                      </span>
                    )}
                  </div>
                )}
                <p className="hidden lg:block text-[11px] text-white/30 leading-relaxed border-t border-white/[0.06] pt-4">
                  Use the arrows or month menu to move between finalized months. Member drill-down opens on the right.
                </p>
              </div>
            </aside>
            <div className="lg:col-span-8 space-y-5 min-w-0">
            {pickerMonths.length === 0 && !showPicker && !showYearPicker && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/80 leading-relaxed">
                <p className="font-semibold text-amber-100/90 mb-1">No closed months in History yet</p>
                <p className="text-amber-200/60">
                  This page only lists <span className="text-amber-100/80">finalized</span> months (after month close). The{" "}
                  <span className="text-amber-100/80">current month</span> stays on Entries and Payments until it is closed.
                </p>
              </div>
            )}
          <div>
            {isLoading ? (
              <div className="py-20 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#7c3fbf] border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* 3 summary cards — compact on mobile, dashboard-style on md+ */}
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-5 md:mb-6">
                  {([
                    {
                      label: "Total Spent",
                      value: !hasMonthlySnapshot
                        ? "₹0"
                        : isHistoricalSummary
                        ? `₹${(monthlyHistoryRecord!.grandTotal as number).toLocaleString("en-IN")}`
                        : `₹${displayTotalEntryAmt.toLocaleString("en-IN")}`,
                      sub: !hasMonthlySnapshot
                        ? "No monthly snapshot"
                        : isHistoricalSummary
                        ? `${(monthlyHistoryRecord!.members as any[]).length} members`
                        : filteredEntries.length === 0 && monthlyHistoryRecord
                          ? `${userStats.length} members (summary)`
                          : `${filteredEntries.length} entries`,
                      Icon: FiBarChart2,
                      accent: "from-emerald-500/25 to-emerald-600/5",
                      vcls: "text-emerald-400",
                    },
                    {
                      label: "Members",
                      value: !hasMonthlySnapshot
                        ? "0"
                        : isHistoricalSummary
                        ? String((monthlyHistoryRecord!.members as any[]).length)
                        : String(userStats.length),
                      sub:   !hasMonthlySnapshot ? "—" : "active this month",
                      Icon: FiUsers,
                      accent: "from-[#7c3fbf]/35 to-[#582c84]/10",
                      vcls: "text-[#c49bff]",
                    },
                    {
                      label: "Penalties",
                      value: !hasMonthlySnapshot
                        ? "₹0"
                        : isHistoricalSummary
                        ? `₹${(monthlyHistoryRecord!.members as any[]).reduce((s: number, m: any) => s + m.penaltyAmount, 0).toLocaleString("en-IN")}`
                        : `₹${displayTotalPenaltyAmt.toLocaleString("en-IN")}`,
                      sub: !hasMonthlySnapshot
                        ? "—"
                        : isHistoricalSummary
                        ? `${(monthlyHistoryRecord!.members as any[]).filter((m: any) => m.penaltyAmount > 0).length} penalised`
                        : filteredPenalties.length === 0 && monthlyHistoryRecord
                          ? `${userStats.filter(u => u.penaltyAmount > 0).length} penalised (summary)`
                          : `${filteredPenalties.length} issued`,
                      Icon: FiAlertTriangle,
                      accent: "from-amber-500/25 to-amber-600/5",
                      vcls: "text-amber-400",
                    },
                  ] as const).map((s) => (
                    <div
                      key={s.label}
                      className="group relative overflow-hidden rounded-xl md:rounded-2xl border border-white/[0.08] bg-[#111120]/80 md:bg-[#111120]/60 md:hover:border-[#7c3fbf]/30 md:transition-all md:duration-300"
                    >
                      <div className={cn("hidden md:block absolute inset-0 bg-gradient-to-br opacity-80 pointer-events-none", s.accent)} />
                      <div className="hidden md:block absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-[0.07]" />
                      <div className="relative p-2 py-3 md:p-5 md:flex md:flex-col md:min-h-[132px] md:justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[8px] md:text-[10px] text-white/40 uppercase tracking-wider font-semibold leading-tight">{s.label}</p>
                          <div className="hidden md:flex p-2 rounded-full bg-white/10 text-white/90 shrink-0">
                            <s.Icon className="h-5 w-5" aria-hidden />
                          </div>
                        </div>
                        <div className="md:mt-3">
                          <p className={cn("text-base md:text-2xl font-bold leading-tight tabular-nums", s.vcls)}>{s.value}</p>
                          <p className="text-[9px] md:text-xs text-white/30 mt-1 leading-snug line-clamp-2">{s.sub}</p>
                        </div>
                        <div className="hidden md:block mt-4 pt-3 border-t border-white/10">
                          <span className="text-[11px] text-white/45">Month summary</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bar chart - live or historical */}
                {(isHistoricalSummary ? historicalChartData.length > 0 : chartData.length > 0) && (
                  <div className="bg-[#111120] border border-white/[0.06] rounded-2xl overflow-hidden mb-4">
                    <div className="flex items-center justify-between px-4 pt-4 pb-1">
                      <div>
                        <p className="text-xs font-semibold text-white/55">Monthly Breakdown</p>
                        <p className="text-[9px] text-white/20 mt-0.5">
                          {isHistoricalSummary
                            ? "Final closed-period totals"
                            : (
                              <>
                                <span className="md:hidden">Tap a bar → member details (read-only)</span>
                                <span className="hidden md:inline">Click a bar for member details (read-only)</span>
                              </>
                            )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-[9px] text-white/30">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "linear-gradient(180deg,#c49bff,#7c3fbf)" }} />
                          Entries
                        </span>
                        <span className="flex items-center gap-1.5 text-[9px] text-white/30">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-400/80" />
                          Penalties
                        </span>
                      </div>
                    </div>
                    <div className="h-[190px] md:h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={isHistoricalSummary ? historicalChartData : chartData}
                        barSize={24}
                        barCategoryGap="30%"
                        style={{ cursor: isHistoricalSummary ? "default" : "pointer" }}
                        onClick={isHistoricalSummary ? undefined : (data) => {
                          const uid = data?.activePayload?.[0]?.payload?.userId;
                          if (uid) setSelectedUserId(uid);
                        }}
                      >
                        <defs>
                          <linearGradient id="entryGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#d8b4fe" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#7c3fbf" stopOpacity={0.85} />
                          </linearGradient>
                          <linearGradient id="penaltyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fde68a" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.85} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ fill: "rgba(124,63,191,0.1)" }}
                        />
                        <Bar dataKey="entries"   stackId="a" fill="url(#entryGrad)"   radius={[0, 0, 4, 4]}
                          activeBar={{ fill: "#e9d5ff", opacity: 1 }} />
                        <Bar dataKey="penalties" stackId="a" fill="url(#penaltyGrad)" radius={[4, 4, 0, 0]}
                          activeBar={{ fill: "#fde68a", opacity: 1 }} />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Per-user cards */}
                {!hasMonthlySnapshot ? (
                  <div className="bg-[#111120] border border-white/[0.05] rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                    <p className="text-3xl">📭</p>
                    <p className="text-white/50 text-sm font-semibold">No closed snapshot for this month</p>
                    <p className="text-white/25 text-xs max-w-xs leading-relaxed">
                      There is no finalized <span className="text-white/40">MonthlyHistory</span> row for{" "}
                      {format(currentDate, "MMMM yyyy")} that is marked closed. When the accounting month is closed (month-end process), it appears here automatically. For in-progress activity, use Entries or Payments.
                    </p>
                  </div>
                ) : !isHistoricalSummary && userStats.length === 0 ? (
                  <div className="bg-[#111120] border border-white/[0.05] rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                    <div className="flex items-end gap-2 mb-1 opacity-[0.07]">
                      {[55, 80, 40, 70, 50, 65].map((h, i) => (
                        <div key={i} className="w-5 rounded-t-md bg-[#c49bff]" style={{ height: h }} />
                      ))}
                    </div>
                    <p className="text-3xl">📭</p>
                    <p className="text-white/50 text-sm font-semibold">No activity this month</p>
                    <p className="text-white/25 text-xs max-w-xs leading-relaxed">
                      No entries or penalties were recorded in {format(currentDate, "MMMM yyyy")}.
                      Use ← or the dropdown to browse other months.
                    </p>
                  </div>
                ) : isHistoricalSummary ? (
                  /* ── Historical summary from seed data ── */
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Members</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#7c3fbf]/20 border border-[#7c3fbf]/30 text-[#c49bff]/70 font-medium">
                        📊 Summary Data
                      </span>
                    </div>
                    <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                      {(monthlyHistoryRecord.members as any[]).map((m: any) => {
                        const net = m.entryAmount - m.penaltyAmount;
                        const totalEntry = (monthlyHistoryRecord.members as any[]).reduce((s: number, x: any) => s + x.entryAmount, 0);
                        const sharePercent = totalEntry > 0 ? Math.round((m.entryAmount / totalEntry) * 100) : 0;
                        return (
                          <div key={m.name} className="w-full bg-[#111120] border border-white/[0.06] rounded-2xl px-4 py-3.5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#582c84]/25 border border-[#7c3fbf]/20 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-[#c49bff]">{getInitials(m.name)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white leading-tight">{m.name}</p>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-[11px] text-emerald-400 font-medium">
                                  📋 ₹{m.entryAmount.toLocaleString("en-IN")}
                                </span>
                                {m.penaltyAmount > 0 && (
                                  <span className="text-[11px] text-amber-400 font-medium">
                                    ⚠️ ₹{m.penaltyAmount.toLocaleString("en-IN")} penalty
                                  </span>
                                )}
                              </div>
                              <div className="w-full h-1 bg-white/[0.05] rounded-full mt-2 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#7c3fbf] to-[#c49bff] rounded-full"
                                  style={{ width: `${sharePercent}%` }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={cn("text-sm font-bold", net >= 0 ? "text-emerald-400" : "text-red-400")}>
                                ₹{net.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[9px] text-white/25 mt-0.5">net</p>
                            </div>
                          </div>
                        );
                      })}
                      <div className="mt-1 md:mt-0 md:col-span-2 bg-[#111120] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center justify-between">
                        <span className="text-xs text-white/40 font-medium">Grand Total</span>
                        <span className="text-base font-bold text-white">₹{(monthlyHistoryRecord.grandTotal as number).toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 md:space-y-0">
                    <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-1 mb-2 md:mb-3">
                      <span className="md:hidden">Members · tap to view details</span>
                      <span className="hidden md:inline">Members · click a row for details</span>
                    </p>
                    <div className="md:grid md:grid-cols-2 md:gap-3 md:space-y-0 space-y-2">
                    {userStats.map(s => {
                      const sharePercent = userStatsEntrySum > 0
                        ? Math.round((s.entryAmount / userStatsEntrySum) * 100)
                        : 0;
                      return (
                        <button
                          key={s.userId}
                          type="button"
                          onClick={() => setSelectedUserId(s.userId)}
                          className="w-full bg-[#111120] hover:bg-[#15152a] border border-white/[0.06] hover:border-[#7c3fbf]/30 rounded-2xl transition-all flex items-center px-4 py-3.5 text-left active:scale-[0.99]"
                        >
                            <Avatar className="w-10 h-10 shrink-0">
                              <AvatarImage src={s.avatar} />
                              <AvatarFallback className="bg-[#582c84]/25 text-[#c49bff] text-xs font-bold">
                                {getInitials(s.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white leading-tight">{s.name}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-[11px] text-emerald-400 font-medium">
                                  📋 {s.entryCount} · ₹{s.entryAmount.toLocaleString("en-IN")}
                                </span>
                                {s.penaltyCount > 0 && (
                                  <span className="text-[11px] text-amber-400 font-medium">
                                    ⚠️ {s.penaltyCount} penalties
                                  </span>
                                )}
                              </div>
                              <div className="w-full h-1 bg-white/[0.05] rounded-full mt-2 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#7c3fbf] to-[#c49bff] rounded-full transition-all duration-500"
                                  style={{ width: `${sharePercent}%` }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold text-[#c49bff]">{sharePercent}%</p>
                              <p className="text-[9px] text-white/25 mt-0.5">share</p>
                            </div>
                            <FiChevronRight className="w-4 h-4 text-white/20 shrink-0" />
                        </button>
                      );
                    })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
            </div>
          </div>
        )}

      </div>

      <div className="block md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
