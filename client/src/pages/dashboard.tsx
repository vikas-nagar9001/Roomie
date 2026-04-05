import { useAuth } from "@/hooks/use-auth";
import {
  FiUsers,
  FiList,
  FiCreditCard,
  FiAlertTriangle,
  FiClock,
  FiArrowUpRight,
  FiCheckCircle,
} from "react-icons/fi";
import { DesktopLiveDashboard } from "@/components/dashboard/desktop-live-dashboard";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { Header } from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { isFirstPWAOpen, logPWAStatus } from "@/lib/pwa-utils";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface BillSummary {
  _id: string;
  month: string;
  year: number;
  totalAmount: number;
}

interface MarchPaymentRow {
  paidAmount: number;
  amount: number;
  totalDue: number;
  penalty: number;
  penaltyWaived?: boolean;
}

interface BillDetailMarch extends BillSummary {
  payments: Array<{
    userId: { _id: string };
    paidAmount: number;
    amount: number;
    totalDue: number;
    penalty: number;
    penaltyWaived?: boolean;
  }>;
}

function effectivePaymentDue(p: MarchPaymentRow): number {
  const base = p.totalDue > 0 ? p.totalDue : p.amount;
  const penalty = p.penaltyWaived ? 0 : Number(p.penalty) || 0;
  return base + penalty;
}

function fmtInr(n: number) {
  return `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("");

  // Show loader when the page first loads
  useEffect(() => {
    showLoader();
    
    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);

  // Dashboard initialization
  useEffect(() => {
    if (!user) return;

    const handleDashboardInit = async () => {
      try {
        console.log('🎯 Dashboard loaded - initializing...');
        
        // Log PWA status for debugging
        logPWAStatus();
        
        // Check if this is first PWA open
        const isFirstPWA = isFirstPWAOpen();
        if (isFirstPWA) {
          console.log('🚀 First PWA open detected!');
        }
      } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
      }
    };

    handleDashboardInit();
  }, [user]);
  // Fetch entries data
  const { data: entries, isLoading: entriesLoading } = useQuery<any[]>({
    queryKey: ["/api/entries"],
  });

  const { data: bills = [] } = useQuery<BillSummary[]>({
    queryKey: ["/api/bills"],
  });

  const latestMarchBill = useMemo(() => {
    const mar = bills.filter((b) => String(b.month).trim().toLowerCase() === "march");
    return mar.sort((a, b) => b.year - a.year)[0] ?? null;
  }, [bills]);

  const { data: marchBillDetail } = useQuery<BillDetailMarch>({
    queryKey: ["/api/bills", latestMarchBill?._id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bills/${latestMarchBill!._id}`);
      return res.json();
    },
    enabled: Boolean(latestMarchBill?._id),
  });

  const myMarchShare = useMemo(() => {
    if (!marchBillDetail?.payments?.length || !user?._id) return null;
    const uid = user._id.toString();
    const row = marchBillDetail.payments.find((p) => p.userId?._id?.toString() === uid);
    if (!row) return null;
    const total = effectivePaymentDue(row);
    const paid = Number(row.paidAmount) || 0;
    const remaining = Math.max(0, total - paid);
    return { total, paid, remaining, year: marchBillDetail.year };
  }, [marchBillDetail, user?._id]);

  const approvedCount =
    entries?.filter((e) => {
      const entryUserId =
        typeof e.userId === "object" && e.userId !== null
          ? (e.userId._id || e.userId.id || e.userId)
          : e.userId;
      return entryUserId?.toString() === user?._id?.toString() && e.status === "APPROVED";
    }).length ?? 0;

  const pendingCount =
    entries?.filter((e) => {
      const entryUserId =
        typeof e.userId === "object" && e.userId !== null
          ? (e.userId._id || e.userId.id || e.userId)
          : e.userId;
      return entryUserId?.toString() === user?._id?.toString() && e.status === "PENDING";
    }).length ?? 0;

  useEffect(() => {
    if (!entriesLoading) {
      const t = setTimeout(() => hideLoader(), 280);
      return () => clearTimeout(t);
    }
  }, [entriesLoading]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // Mobile View Component
  const MobileView = () => (
    <div className="pt-[96px] pb-28 min-h-screen bg-[#0f0f1f]">
      {/* Glass Morphism Effect */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[#0f0f1f]"></div>
        <div className="absolute top-0 left-0 right-0 h-96 bg-[#0f0f1f]"></div>
      </div>

      <Header />

      {/* Mobile — same horizontal padding as jump tiles’ outer gutter */}
      <main className="relative px-2.5 py-4">
        {/* Greeting (transparent) · appr → pend circles in a row */}
        <div className="relative mb-5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 bg-transparent pr-1">
            <p className="text-xs text-indigo-200/80">{greeting},</p>
            <h1 className="mt-1 text-[1.65rem] font-bold leading-tight tracking-tight text-white">
              <span className="text-[#c49bff]">{user?.name?.split(" ")[0]}</span>{" "}
              <span className="text-white/90">👋</span>
            </h1>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-2.5">
            <div className="flex h-[2.75rem] w-[2.75rem] flex-col items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10">
              <span className="text-base font-bold tabular-nums leading-none text-emerald-200">{approvedCount}</span>
              <span className="mt-0.5 text-[6px] font-bold uppercase tracking-wider text-emerald-300/60">appr</span>
            </div>
            <div className="flex h-[2.75rem] w-[2.75rem] flex-col items-center justify-center rounded-full border border-amber-500/35 bg-amber-500/10">
              <span className="text-base font-bold tabular-nums leading-none text-amber-200">{pendingCount}</span>
              <span className="mt-0.5 text-[6px] font-bold uppercase tracking-wider text-amber-300/60">pend</span>
            </div>
          </div>
        </div>

        {/* Latest March bill — pulled up under greeting */}
        {latestMarchBill && myMarchShare && (
          <Link
            href={`/payments?billId=${latestMarchBill._id}`}
            className="mb-3 block touch-manipulation"
          >
            <div className="relative overflow-hidden rounded-2xl border-0 bg-[#13131c] px-3.5 pb-3.5 pt-4 shadow-[0_6px_0_0_rgba(0,0,0,0.42),0_14px_40px_rgba(88,44,132,0.22),0_0_0_1px_rgba(124,63,191,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#582c84]/14 via-transparent to-[#13131c]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c49bff]/45 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-[0.045]" />
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#582c84]/30 blur-3xl" />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c49bff]/80">
                    March {myMarchShare.year}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white leading-snug">Your bill share</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#582c84]/90 ring-1 ring-[#7c3fbf]/45">
                  <FiCreditCard className="h-[18px] w-[18px] text-[#c49bff]" />
                </div>
              </div>
              <div className="relative mt-3 flex items-stretch gap-0 overflow-hidden rounded-xl border-0 bg-[#0f0f18]/95 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4),0_0_0_1px_rgba(124,63,191,0.18)]">
                <div className="min-w-0 flex-1 px-3.5 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[#c49bff]/75">Paid</p>
                  <p className="mt-1 text-lg font-bold tabular-nums leading-tight text-white">
                    {fmtInr(myMarchShare.paid)}
                  </p>
                </div>
                <div className="w-px shrink-0 bg-[#7c3fbf]/30 my-2.5" />
                <div className="min-w-0 flex-1 px-3.5 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-indigo-200/55">Remaining</p>
                  <p className="mt-1 text-lg font-bold tabular-nums leading-tight text-indigo-100">
                    {fmtInr(myMarchShare.remaining)}
                  </p>
                </div>
              </div>
              {myMarchShare.total > 0 && (
                <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-[#7c3fbf]/20">
                  <div
                    className="h-full rounded-full bg-[#7c3fbf] shadow-[0_0_12px_rgba(124,63,191,0.5)] transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((myMarchShare.paid / myMarchShare.total) * 100))}%`,
                    }}
                  />
                </div>
              )}
              <div className="relative mt-2 flex items-center justify-between text-[9px] text-indigo-200/50">
                <span className="inline-flex items-center gap-1">
                  <FiCheckCircle className="h-3 w-3 text-[#c49bff]" />
                  {myMarchShare.remaining <= 0 ? "Settled for March" : "Tap to open Payments"}
                </span>
                <FiArrowUpRight className="h-3.5 w-3.5 -rotate-12 text-[#c49bff]/60" />
              </div>
            </div>
          </Link>
        )}

        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200/40 mb-1.5">
          Jump to
        </p>

        <div className="grid w-full grid-cols-2 gap-2.5 pb-0.5">
          <Link href="/entries" className="group block touch-manipulation">
            <div className="relative aspect-square overflow-hidden rounded-2xl border-0 bg-[#582c84] shadow-[0_5px_0_0_rgba(0,0,0,0.45),0_12px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(124,63,191,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.97] active:shadow-[0_3px_0_0_rgba(0,0,0,0.4)] transition-transform">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c49bff]/35 to-transparent" />
              <FiArrowUpRight className="absolute right-2.5 top-2.5 z-10 h-4 w-4 rotate-12 text-[#c49bff]/70 transition-transform group-hover:rotate-45 group-hover:text-[#c49bff]" />
              <div className="absolute inset-0 bg-black/25 pointer-events-none" />
              <div className="relative flex h-full flex-col items-center justify-center gap-2 px-4 pb-4 pt-5 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/25 ring-1 ring-[#7c3fbf]/35">
                  <FiList className="h-5 w-5 text-[#c49bff]" />
                </div>
                <h3 className="text-sm font-semibold leading-tight text-white">Entries</h3>
                <p className="line-clamp-2 text-[10px] leading-snug text-indigo-200/75">Flat expenses</p>
              </div>
            </div>
          </Link>

          <Link href="/payments" className="group block touch-manipulation">
            <div className="relative aspect-square overflow-hidden rounded-2xl border-0 bg-[#582c84] shadow-[0_5px_0_0_rgba(0,0,0,0.45),0_12px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(124,63,191,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.97] active:shadow-[0_3px_0_0_rgba(0,0,0,0.4)] transition-transform">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c49bff]/35 to-transparent" />
              <FiArrowUpRight className="absolute right-2.5 top-2.5 z-10 h-4 w-4 rotate-12 text-[#c49bff]/70 transition-transform group-hover:rotate-45 group-hover:text-[#c49bff]" />
              <div className="absolute inset-0 bg-black/25 pointer-events-none" />
              <div className="relative flex h-full flex-col items-center justify-center gap-2 px-4 pb-4 pt-5 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/25 ring-1 ring-[#7c3fbf]/35">
                  <FiCreditCard className="h-5 w-5 text-[#c49bff]" />
                </div>
                <h3 className="text-sm font-semibold leading-tight text-white">Payments</h3>
                <p className="line-clamp-2 text-[10px] leading-snug text-indigo-200/75">Bills & dues</p>
              </div>
            </div>
          </Link>

          <Link href="/penalties" className="group block touch-manipulation">
            <div className="relative aspect-square overflow-hidden rounded-2xl border-0 bg-[#582c84] shadow-[0_5px_0_0_rgba(0,0,0,0.45),0_12px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-amber-500/10 active:scale-[0.97] active:shadow-[0_3px_0_0_rgba(0,0,0,0.4)] transition-transform">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" />
              <FiArrowUpRight className="absolute right-2.5 top-2.5 z-10 h-4 w-4 rotate-12 text-[#c49bff]/70 transition-transform group-hover:rotate-45 group-hover:text-[#c49bff]" />
              <div className="absolute inset-0 bg-black/25 pointer-events-none" />
              <div className="relative flex h-full flex-col items-center justify-center gap-2 px-4 pb-4 pt-5 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/25 ring-1 ring-amber-500/25">
                  <FiAlertTriangle className="h-5 w-5 text-amber-200/95" />
                </div>
                <h3 className="text-sm font-semibold leading-tight text-white">Penalties</h3>
                <p className="line-clamp-2 text-[10px] leading-snug text-indigo-200/75">Fines & waivers</p>
              </div>
            </div>
          </Link>

          <Link href="/history" className="group block touch-manipulation">
            <div className="relative aspect-square overflow-hidden rounded-2xl border-0 bg-[#3d2560] shadow-[0_5px_0_0_rgba(0,0,0,0.45),0_12px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(99,60,150,0.35),inset_0_1px_0_rgba(255,255,255,0.07)] active:scale-[0.97] active:shadow-[0_3px_0_0_rgba(0,0,0,0.4)] transition-transform">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/30 to-transparent" />
              <FiArrowUpRight className="absolute right-2.5 top-2.5 z-10 h-4 w-4 rotate-12 text-[#c49bff]/70 transition-transform group-hover:rotate-45 group-hover:text-[#c49bff]" />
              <div className="absolute inset-0 bg-black/25 pointer-events-none" />
              <div className="relative flex h-full flex-col items-center justify-center gap-2 px-4 pb-4 pt-4 text-center">
                <span className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c49bff]/70">
                  Archive
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/20 ring-1 ring-[#7c3fbf]/30">
                  <FiClock className="h-5 w-5 text-[#c49bff]" />
                </div>
                <h3 className="text-sm font-semibold leading-tight text-white">History</h3>
                <p className="line-clamp-2 text-[10px] leading-snug text-indigo-200/70">Past months</p>
              </div>
            </div>
          </Link>

          {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
            <Link href="/manage-users" className="group col-span-2 block touch-manipulation">
              <div className="relative flex min-h-[4.25rem] items-center gap-3.5 overflow-hidden rounded-2xl border-0 bg-[#5c2f8a] px-3.5 py-3.5 shadow-[0_5px_0_0_rgba(0,0,0,0.45),0_12px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(167,100,220,0.28),inset_0_1px_0_rgba(255,255,255,0.09)] active:scale-[0.99] active:shadow-[0_3px_0_0_rgba(0,0,0,0.4)] transition-transform">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8b4fe]/35 to-transparent" />
                <div className="absolute inset-0 bg-black/25 pointer-events-none" />
                <FiArrowUpRight className="absolute right-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rotate-12 text-[#c49bff]/70 transition-transform group-hover:rotate-45 group-hover:text-[#c49bff]" />
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20 ring-1 ring-[#7c3fbf]/35">
                  <FiUsers className="h-[18px] w-[18px] text-[#c49bff]" />
                </div>
                <div className="relative z-10 min-w-0 flex-1 pr-8">
                  <h3 className="text-xs font-semibold leading-tight text-white">Users</h3>
                  <p className="mt-1 text-[9px] leading-snug text-indigo-200/70">Roles & access · admin only</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        <MobileNav />
      </main>
    </div>
  );

  // Desktop View Component
  const DesktopView = () => (
    <>
      <Header />

      <div className="min-h-screen w-full relative flex flex-col bg-[#0f0f1f] pt-[80px] md:pl-[272px]">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-[#0f0f1f] blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[70%] h-[40vh] bg-[#582c84]/[0.08] blur-3xl" />

        {/* Main Content */}
        <div className="relative z-10 container mx-auto max-w-7xl px-6 py-12">
          {/* Welcome Section */}
          <div className="mb-10">
            <h2 className="text-xl text-indigo-300/80 font-medium mb-2">{greeting},</h2>
            <h1 className="text-4xl font-bold text-white tracking-tight">{user?.name?.split(" ")[0]} <span className="inline-block animate-wave">👋</span></h1>
            <p className="text-sm text-indigo-200/50 mt-3 max-w-2xl">
              {"Here is your flat's live view for the current month: expenses, payments, penalties, and who owes what."}
            </p>
          </div>

          <DesktopLiveDashboard user={user} />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Show Mobile View for screens smaller than md breakpoint */}
      <div className="block md:hidden">
        <MobileView />
      </div>

      {/* Show Desktop View for md and larger screens */}
      <div className="hidden md:block">
        <DesktopView />
      </div>

    </>
  );
}