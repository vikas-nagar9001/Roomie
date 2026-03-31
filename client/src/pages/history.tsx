import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { showSuccess, showError } from "@/services/toastService";
import {
  format, addMonths, subMonths,
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
  FiDownload, FiTrash2, FiAlertOctagon, FiSave,
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
      <p className="text-[9px] text-[#c49bff]/30 mt-2 text-center">tap to view details</p>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const now = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"all" | "entry" | "penalty">("all");
  const [entryStatusFilter, setEntryStatusFilter] = useState<string>("all");
  const [penaltyTypeFilter, setPenaltyTypeFilter] = useState<string>("all");
  const [showPicker, setShowPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "CO_ADMIN";
  const qc = useQueryClient();

  // Admin — confirm modal state
  type ConfirmAction =
    | { kind: "backup-all" }
    | { kind: "backup-year"; year: number }
    | { kind: "all" }
    | { kind: "year"; year: number }
    | { kind: "month"; id: string; label: string };
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Admin — delete mutations
  const deleteAll = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/monthly-history/all"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/monthly-history"] }); showSuccess("All history deleted"); setConfirmAction(null); },
    onError: () => showError("Delete failed"),
  });
  const deleteYear = useMutation({
    mutationFn: (year: number) => apiRequest("DELETE", `/api/monthly-history/year/${year}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/monthly-history"] }); showSuccess("Year history deleted"); setConfirmAction(null); },
    onError: () => showError("Delete failed"),
  });
  const deleteMonth = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/monthly-history/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/monthly-history"] }); showSuccess("Month deleted"); setConfirmAction(null); },
    onError: () => showError("Delete failed"),
  });

  // Admin — snapshot mutation (save current or any month to monthly history)
  const snapshotMutation = useMutation({
    mutationFn: ({ year, monthIndex }: { year: number; monthIndex: number }) =>
      apiRequest("POST", "/api/monthly-history/snapshot", { year, monthIndex }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/monthly-history"] });
      const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      showSuccess(`Snapshot saved for ${names[vars.monthIndex]} ${vars.year}`);
    },
    onError: () => showError("Snapshot failed"),
  });

  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.kind === "backup-all")  { window.open("/api/monthly-history/backup", "_blank"); setConfirmAction(null); return; }
    if (confirmAction.kind === "backup-year") { window.open(`/api/monthly-history/backup?year=${confirmAction.year}`, "_blank"); setConfirmAction(null); return; }
    if (confirmAction.kind === "all")   deleteAll.mutate();
    if (confirmAction.kind === "year")  deleteYear.mutate(confirmAction.year);
    if (confirmAction.kind === "month") deleteMonth.mutate(confirmAction.id);
  }

  function downloadBackup() {
    setConfirmAction({ kind: "backup-all" });
  }

  const monthStart     = startOfMonth(currentDate);
  const monthEnd       = endOfMonth(currentDate);
  const isCurrentMonth = currentDate.getMonth() === now.getMonth() &&
                         currentDate.getFullYear() === now.getFullYear();

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

  // Saved snapshot for the visible month (if any) — used to merge members missing from live ledger
  const monthlyHistoryRecord = useMemo(() => {
    const y = currentDate.getFullYear();
    const idx0 = currentDate.getMonth(); // 0-based: Jan=0 ... Dec=11
    const idx1 = idx0 + 1; // 1-based: Jan=1 ... Dec=12 (older records)

    // Prefer correct 0-based match if both exist.
    const exact0 =
      monthlyHistories.find(
        (r: { year: number; monthIndex: number }) => r.year === y && r.monthIndex === idx0,
      ) ?? null;
    if (exact0) return exact0;

    const exact1 =
      monthlyHistories.find(
        (r: { year: number; monthIndex: number }) => r.year === y && r.monthIndex === idx1,
      ) ?? null;
    return exact1;
  }, [monthlyHistories, currentDate]);

  /** This page shows MonthlyHistory snapshots only — no live ledger rollup unless a snapshot row exists for that month. */
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

  // ── Month nav handler ─────────────────────────────────────────────────────
  function resetDetail() { setDetailTab("all"); setEntryStatusFilter("all"); setPenaltyTypeFilter("all"); }
  function prevMonth() { setCurrentDate(d => subMonths(d, 1)); setSelectedUserId(null); resetDetail(); }
  function nextMonth() { if (!isCurrentMonth) { setCurrentDate(d => addMonths(d, 1)); setSelectedUserId(null); resetDetail(); } }
  function jumpToMonth(year: number, month: number) {
    setCurrentDate(new Date(year, month, 1));
    setSelectedUserId(null);
    resetDetail();
    setShowPicker(false);
  }
  function jumpToYear(year: number) {
    const isThisYear = year === now.getFullYear();
    if (isThisYear) {
      setCurrentDate(new Date(year, now.getMonth(), 1));
    } else {
      const latest = pickerMonths.find(m => m.year === year);
      if (latest) setCurrentDate(new Date(latest.year, latest.month, 1));
    }
    setSelectedUserId(null);
    resetDetail();
    setShowYearPicker(false);
  }

  // Build list of months from earliest data to current
  const pickerMonths = useMemo(() => {
    const dates = [
      ...entries.map((e: any) => new Date(e.dateTime)),
      ...penalties.map((p: any) => new Date(p.createdAt)),
    ];
    // Also add dates from seeded monthly histories
    monthlyHistories.forEach((r: any) => {
      dates.push(new Date(r.year, r.monthIndex, 1));
    });
    if (dates.length === 0) return [{ year: now.getFullYear(), month: now.getMonth() }];
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 1);
    const months: { year: number; month: number }[] = [];
    let cur = start;
    while (cur <= end) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur = addMonths(cur, 1);
    }
    return months.reverse();
  }, [entries, penalties, monthlyHistories]);

  const availableYears = useMemo(
    () => Array.from(new Set(pickerMonths.map(m => m.year))).sort((a, b) => b - a),
    [pickerMonths]
  );

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
    <div className="min-h-screen bg-[#0f0f1f]">
      <Header />

      <div className="pt-24 pb-28 sm:pb-10 px-3 sm:px-8 max-w-xl sm:max-w-4xl mx-auto">

        {/* ── Filter Bar ── */}
        <div className="flex items-center justify-between mb-5 px-1">

          {/* LEFT — Year + Month filters */}
          <div className="flex items-center gap-2">

            {/* Year pill */}
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

            {/* Month pill */}
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
                        const isNow = now.getFullYear() === year && now.getMonth() === month;
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
                            {isNow && <span className="text-[9px] text-[#c49bff]/50 bg-[#7c3fbf]/20 px-1.5 py-0.5 rounded-full font-bold">Now</span>}
                            {isSel && !isNow && <span className="w-1.5 h-1.5 rounded-full bg-[#c49bff] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — Prev / Next arrows */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg bg-[#7c3fbf]/10 hover:bg-[#7c3fbf]/25 border border-[#7c3fbf]/20 hover:border-[#7c3fbf]/40 flex items-center justify-center transition-all"
            >
              <FiChevronLeft className="w-4 h-4 text-[#c49bff]/70" />
            </button>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className={cn(
                "w-8 h-8 rounded-lg border flex items-center justify-center transition-all",
                isCurrentMonth
                  ? "opacity-20 cursor-not-allowed bg-white/[0.03] border-white/[0.05]"
                  : "bg-[#7c3fbf]/10 hover:bg-[#7c3fbf]/25 border-[#7c3fbf]/20 hover:border-[#7c3fbf]/40"
              )}
            >
              <FiChevronRight className="w-4 h-4 text-[#c49bff]/70" />
            </button>
          </div>
        </div>

        {!showPicker && !showYearPicker && (
          <div className="flex items-center gap-2 mb-5 px-1">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            {isCurrentMonth && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#7c3fbf]/25 border border-[#7c3fbf]/40 text-[#c49bff]/80">
                Current
              </span>
            )}
          </div>
        )}

        {/* ── Admin Panel ── */}
        {isAdmin && !selectedUserId && (
          <div className="mb-4">
            <button
              onClick={() => setShowAdminPanel(v => !v)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                showAdminPanel
                  ? "bg-[#582c84]/20 border-[#7c3fbf]/40 text-[#c49bff]"
                  : "bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/60 hover:bg-white/[0.05]"
              )}
            >
              <span className="flex items-center gap-2">
                <FiAlertOctagon className="w-3.5 h-3.5" />
                Admin Tools
              </span>
              <FiChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showAdminPanel && "rotate-180")} />
            </button>

            {showAdminPanel && (
              <div className="mt-2 bg-[#0f0f1e] border border-white/[0.07] rounded-2xl overflow-hidden">

                {/* ─ Snapshot section */}
                <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.05]">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/50 font-semibold mb-1">Save to History</p>
                  <p className="text-[10px] text-white/30 mb-2.5">Saves approved entries + penalties as a permanent monthly snapshot</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={snapshotMutation.isPending}
                      onClick={() => snapshotMutation.mutate({ year: currentDate.getFullYear(), monthIndex: currentDate.getMonth() })}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400/80 hover:text-emerald-400 text-xs font-semibold transition-all disabled:opacity-40"
                    >
                      <FiSave className="w-3.5 h-3.5" />
                      {format(currentDate, "MMM yyyy")}
                    </button>
                  </div>
                </div>

                {/* ─ Backup section */}
                <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.05]">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2.5">Backup Data — Download CSV</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setConfirmAction({ kind: "backup-all" })}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#7c3fbf]/10 hover:bg-[#7c3fbf]/25 border border-[#7c3fbf]/25 hover:border-[#7c3fbf]/50 text-[#c49bff]/80 hover:text-[#c49bff] text-xs font-semibold transition-all"
                    >
                      <FiDownload className="w-3.5 h-3.5" />
                      All History
                    </button>
                    <button
                      onClick={() => setConfirmAction({ kind: "backup-year", year: currentDate.getFullYear() })}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#7c3fbf]/10 hover:bg-[#7c3fbf]/25 border border-[#7c3fbf]/25 hover:border-[#7c3fbf]/50 text-[#c49bff]/80 hover:text-[#c49bff] text-xs font-semibold transition-all"
                    >
                      <FiDownload className="w-3.5 h-3.5" />
                      {currentDate.getFullYear()} Only
                    </button>
                  </div>
                </div>

                {/* ─ Delete section */}
                {monthlyHistories.length > 0 && (
                <div className="px-4 pt-3.5 pb-3.5">
                  <p className="text-[10px] uppercase tracking-widest text-red-400/40 font-semibold mb-2.5">Delete Records — Cannot be undone</p>
                  <div className="flex flex-wrap gap-2">
                    {monthlyHistoryRecord && (
                      <button
                        onClick={() => setConfirmAction({ kind: "month", id: monthlyHistoryRecord._id as string, label: `${monthlyHistoryRecord.month} ${monthlyHistoryRecord.year}` })}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400/70 hover:text-red-400 text-xs font-semibold transition-all"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                        {format(currentDate, "MMM yyyy")}
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmAction({ kind: "year", year: currentDate.getFullYear() })}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400/70 hover:text-red-400 text-xs font-semibold transition-all"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                      All of {currentDate.getFullYear()}
                    </button>
                    <button
                      onClick={() => setConfirmAction({ kind: "all" })}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400/70 hover:text-red-400 text-xs font-semibold transition-all"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                      All History
                    </button>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Unified Confirm Modal ── */}
        {confirmAction && (() => {
          const isBackup = confirmAction.kind.startsWith("backup");
          const title    = isBackup ? "Backup Data" : "Delete Records";
          const subtitle = isBackup ? "CSV file will be downloaded to your device" : "This action is permanent and cannot be undone";

          const scope =
            confirmAction.kind === "backup-all"     ? "All History" :
            confirmAction.kind === "backup-year"    ? `Year ${(confirmAction as any).year}` :
            confirmAction.kind === "all"            ? "All History" :
            confirmAction.kind === "year"           ? `Year ${(confirmAction as any).year}` :
                                                      (confirmAction as any).label;

          const detail =
            confirmAction.kind === "backup-all"
              ? "Every monthly summary across all years will be included in the CSV."
              : confirmAction.kind === "backup-year"
              ? `Only records from ${(confirmAction as any).year} will be included in the CSV.`
              : confirmAction.kind === "all"
              ? "All monthly history records for this flat will be permanently removed from the database."
              : confirmAction.kind === "year"
              ? `All monthly records for the year ${(confirmAction as any).year} will be permanently removed.`
              : `The summary record for ${(confirmAction as any).label} will be permanently removed.`;

          const isPending = deleteAll.isPending || deleteYear.isPending || deleteMonth.isPending;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
              <div className={cn(
                "relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden",
                isBackup ? "bg-[#13132a] border border-[#7c3fbf]/35" : "bg-[#1a0d1a] border border-red-500/30"
              )}>

                {/* Top accent strip */}
                <div className={cn("h-1 w-full", isBackup ? "bg-gradient-to-r from-[#582c84] to-[#c49bff]" : "bg-gradient-to-r from-red-700 to-red-400")} />

                <div className="p-6">
                  {/* Icon + title */}
                  <div className="flex flex-col items-center text-center mb-5">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center mb-3",
                      isBackup ? "bg-[#7c3fbf]/20 border border-[#7c3fbf]/35" : "bg-red-500/15 border border-red-500/30"
                    )}>
                      {isBackup
                        ? <FiDownload className="w-7 h-7 text-[#c49bff]" />
                        : <FiTrash2 className="w-7 h-7 text-red-400" />
                      }
                    </div>
                    <p className="text-white font-bold text-base leading-tight">{title}</p>
                    <p className={cn("text-xs mt-1", isBackup ? "text-[#c49bff]/50" : "text-red-400/50")}>{subtitle}</p>
                  </div>

                  {/* Scope badge */}
                  <div className="flex justify-center mb-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
                      isBackup
                        ? "bg-[#7c3fbf]/15 border-[#7c3fbf]/30 text-[#c49bff]"
                        : "bg-red-500/15 border-red-500/25 text-red-400"
                    )}>
                      {isBackup ? <FiDownload className="w-3 h-3" /> : <FiTrash2 className="w-3 h-3" />}
                      {scope}
                    </span>
                  </div>

                  {/* Detail text */}
                  <p className="text-white/50 text-sm text-center leading-relaxed mb-6">
                    {detail}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] text-white/55 hover:text-white text-sm font-semibold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={isPending}
                      className={cn(
                        "flex-1 h-11 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                        isBackup
                          ? "bg-[#7c3fbf]/25 hover:bg-[#7c3fbf]/40 border border-[#7c3fbf]/40 text-[#c49bff]"
                          : "bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 hover:text-red-300"
                      )}
                    >
                      {isPending
                        ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        : isBackup
                          ? <><FiDownload className="w-4 h-4" />Download</>
                          : <><FiTrash2 className="w-4 h-4" />Delete</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {selectedUserId ? (
          <div>
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
            <div className="grid grid-cols-3 gap-2 mb-5">
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
                <div key={s.label} className={cn("rounded-xl border px-2 py-3 text-center", s.cls)}>
                  <p className={cn("text-xl font-bold leading-none", s.vcls)}>{s.value}</p>
                  <p className="text-[8px] text-white/35 mt-1 uppercase tracking-wider leading-tight">{s.label}</p>
                  <p className="text-[9px] text-white/25 mt-0.5 leading-tight">{s.sub}</p>
                </div>
              ))}
            </div>

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

        ) : (
          /* ═══ OVERVIEW ════════════════════════════════════════════════════ */
          <div>
            {isLoading ? (
              <div className="py-20 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#7c3fbf] border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* 3 summary cards */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
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
                      cls:  "border-emerald-500/20 bg-emerald-500/[0.06]",
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
                      cls:  "border-[#7c3fbf]/25 bg-[#7c3fbf]/[0.07]",
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
                      cls:  "border-amber-500/20 bg-amber-500/[0.06]",
                      vcls: "text-amber-400",
                    },
                  ].map(s => (
                    <div key={s.label} className={cn("rounded-xl border px-2 py-3 text-center", s.cls)}>
                      <p className={cn("text-lg font-bold leading-none", s.vcls)}>{s.value}</p>
                      <p className="text-[8px] text-white/35 mt-1 uppercase tracking-wider leading-tight">{s.label}</p>
                      <p className="text-[9px] text-white/25 mt-0.5 leading-tight">{s.sub}</p>
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
                          {isHistoricalSummary ? "Archived summary data" : "Tap a bar → view member details"}
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
                    <ResponsiveContainer width="100%" height={190}>
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
                )}

                {/* Per-user cards */}
                {!hasMonthlySnapshot ? (
                  <div className="bg-[#111120] border border-white/[0.05] rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                    <p className="text-3xl">📭</p>
                    <p className="text-white/50 text-sm font-semibold">No monthly history saved</p>
                    <p className="text-white/25 text-xs max-w-xs leading-relaxed">
                      There is no <span className="text-white/40">MonthlyHistory</span> row in the database for{" "}
                      {format(currentDate, "MMMM yyyy")}. This screen only shows saved monthly snapshots (not live entries).
                      Save one from <span className="text-white/45">Admin Tools → Save to History</span>, or check the Entries page for current activity.
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
                    <div className="space-y-2">
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
                      <div className="mt-1 bg-[#111120] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center justify-between">
                        <span className="text-xs text-white/40 font-medium">Grand Total</span>
                        <span className="text-base font-bold text-white">₹{(monthlyHistoryRecord.grandTotal as number).toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-1 mb-2">
                      Members · tap to view details
                    </p>
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
                )}
              </>
            )}
          </div>
        )}

      </div>

      <div className="block md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
