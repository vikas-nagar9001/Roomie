import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Settings, Receipt, TrendingUp, TrendingDown,
  Bell, ChevronRight, ChevronDown, History,
  IndianRupee, Users, Trash2, CalendarDays, Pencil, X, Printer, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { showSuccess, showError } from "@/services/toastService";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RECURRING_ITEMS = [
  { name: "Rent", amount: "" },
  { name: "Food Aunty", amount: "" },
  { name: "Electricity", amount: "" },
  { name: "WiFi", amount: "" },
  { name: "Kirana", amount: "" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillItem {
  name: string;
  amount: number;
}

interface BillSummary {
  _id: string;
  month: string;
  year: number;
  totalAmount: number;
  splitAmount: number;
  dueDate: string;
  entryDeductionEnabled: boolean;
  items: BillItem[];
  createdAt: string;
  paymentStatus?: "Paid" | "Pending";
}

interface PaymentRecord {
  _id: string;
  userId: {
    _id: string;
    name: string;
    profilePicture?: string;
    email?: string;
  };
  amount: number;
  paidAmount: number;
  carryForwardAmount: number;
  entryDeduction: number;
  totalDue: number;
  penalty: number;
  penaltyWaived: boolean;
  status: "PAID" | "PENDING";
  dueDate: string;
  paidAt?: string;
}

interface BillDetail extends BillSummary {
  payments: PaymentRecord[];
}

interface FormBillItem {
  name: string;
  amount: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name ? name.split(" ").filter(Boolean).map(w => w[0]?.toUpperCase() || "").join("") : "";

const fmt = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getEffectiveTotalDue = (p: PaymentRecord) => {
  const base = p.totalDue > 0 ? p.totalDue : p.amount;
  const penalty = p.penaltyWaived ? 0 : (p.penalty ?? 0);
  return base + penalty;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "CO_ADMIN";

  useEffect(() => {
    showLoader();
    return () => forceHideLoader();
  }, []);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [recordPayment, setRecordPayment] = useState<PaymentRecord | null>(null);
  const [recordPaymentAmount, setRecordPaymentAmount] = useState("");
  const [billItems, setBillItems] = useState<FormBillItem[]>(
    DEFAULT_RECURRING_ITEMS.map(i => ({ name: i.name, amount: "" }))
  );
  const [entryDeductionEnabled, setEntryDeductionEnabled] = useState(true);
  const [dueDays, setDueDays] = useState(5);
  const [settings, setSettings] = useState({
    defaultDueDate: 5,
    penaltyAmount: 50,
    reminderFrequency: 3,
    customSplitEnabled: false,
  });
  const [isDeleteBillOpen, setIsDeleteBillOpen] = useState(false);
  const [billToDeleteId, setBillToDeleteId] = useState<string | null>(null);
  const [isDeleteAllBillsOpen, setIsDeleteAllBillsOpen] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: bills = [], isLoading: billsLoading } = useQuery<BillSummary[]>({
    queryKey: ["/api/bills"],
  });

  const { data: billDetail, isLoading: detailLoading } = useQuery<BillDetail>({
    queryKey: ["/api/bills", selectedBillId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bills/${selectedBillId}`);
      if (!res.ok) throw new Error("Failed to fetch bill");
      return res.json();
    },
    enabled: !!selectedBillId,
  });

  const { data: paymentSettings } = useQuery<typeof settings>({
    queryKey: ["/api/payment-settings"],
  });

  // When opened from notification (e.g. /payments?billId=xxx), select that bill
  const [location] = useLocation();
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const billIdFromUrl = params.get("billId");
    if (billIdFromUrl && bills.some((b) => b._id === billIdFromUrl)) {
      setSelectedBillId(billIdFromUrl);
      // Clean URL so refresh doesn't keep the param
      if (window.history.replaceState) {
        window.history.replaceState({}, "", "/payments");
      }
    }
  }, [location, bills]);

  // Auto-select latest bill when no billId in URL
  useEffect(() => {
    if (bills.length > 0 && !selectedBillId) {
      setSelectedBillId(bills[0]._id);
    }
  }, [bills, selectedBillId]);

  // Hide global loader when bills are ready
  useEffect(() => {
    if (!billsLoading) hideLoader();
  }, [billsLoading]);

  // Sync settings from server
  useEffect(() => {
    if (paymentSettings) {
      setSettings(paymentSettings);
      setDueDays(paymentSettings.defaultDueDate || 5);
    }
  }, [paymentSettings]);

  // ─── Derived Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!billDetail?.payments) return { total: 0, received: 0, pending: 0 };
    const payments = billDetail.payments;
    const total = billDetail.totalAmount;
    const received = payments.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const pending = payments.reduce((s, p) => {
      const due = getEffectiveTotalDue(p);
      return s + Math.max(0, due - (p.paidAmount || 0));
    }, 0);
    return { total, received, pending };
  }, [billDetail]);

  const billTotal = useMemo(
    () => billItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    [billItems]
  );

  const filteredBills = useMemo(() => {
    let list = bills;
    if (filterYear) list = list.filter(b => String(b.year) === filterYear);
    if (filterMonth) list = list.filter(b => b.month === filterMonth);
    return list;
  }, [bills, filterYear, filterMonth]);

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(bills.map(b => b.year))).sort((a, b) => b - a);
    return years;
  }, [bills]);
  const monthOptions = useMemo(() => {
    const months = Array.from(new Set(bills.map(b => b.month))).filter(Boolean).sort((a, b) => {
      const order = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return order.indexOf(a) - order.indexOf(b);
    });
    return months;
  }, [bills]);

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const createBillMutation = useMutation({
    mutationFn: async () => {
      const items = billItems
        .filter(i => i.name.trim() && parseFloat(i.amount) > 0)
        .map(i => ({ name: i.name.trim(), amount: parseFloat(i.amount) }));

      if (items.length === 0) throw new Error("Add at least one item with an amount");

      const totalAmount = items.reduce((s, i) => s + i.amount, 0);
      const now = new Date();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDays);
      if (dueDate <= now) dueDate.setMonth(dueDate.getMonth() + 1);

      showLoader();
      const res = await apiRequest("POST", "/api/bills", {
        items,
        totalAmount,
        month: now.toLocaleString("default", { month: "long" }),
        year: now.getFullYear(),
        dueDate: dueDate.toISOString(),
        entryDeductionEnabled,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create bill");
      }
      return res.json();
    },
    onSuccess: (data: BillDetail) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills", data._id] });
      setSelectedBillId(data._id);
      setIsCreateBillOpen(false);
      setBillItems(DEFAULT_RECURRING_ITEMS.map(i => ({ name: i.name, amount: "" })));
      setEntryDeductionEnabled(true);
      showSuccess("Bill created successfully!");
      hideLoader();
    },
    onError: (err: any) => {
      showError(err.message || "Failed to create bill");
      hideLoader();
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!recordPayment) throw new Error("No payment selected");
      const amount = parseFloat(recordPaymentAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Enter a valid amount");
      const totalDue = getEffectiveTotalDue(recordPayment);
      const maxAllowed = totalDue - (recordPayment.paidAmount || 0);
      if (amount > maxAllowed + 0.01) {
        throw new Error(`Cannot exceed remaining: ${fmt(maxAllowed)}`);
      }
      const newPaidTotal = parseFloat(((recordPayment.paidAmount || 0) + amount).toFixed(2));
      showLoader();
      const res = await apiRequest("PATCH", `/api/payments/${recordPayment._id}`, {
        paidAmount: newPaidTotal,
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills", selectedBillId] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setRecordPayment(null);
      setRecordPaymentAmount("");
      showSuccess("Payment recorded!");
      hideLoader();
    },
    onError: (err: any) => {
      showError(err.message || "Failed to record payment");
      hideLoader();
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      showLoader();
      const res = await apiRequest("POST", `/api/payments/${paymentId}/remind`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to send reminder");
    },
    onSuccess: () => {
      showSuccess("Reminder sent!");
      hideLoader();
    },
    onError: (err: any) => {
      showError(err.message || "Failed to send reminder");
      hideLoader();
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      showLoader();
      const res = await apiRequest("DELETE", `/api/bills/${billId}`);
      if (!res.ok) throw new Error("Failed to delete bill");
    },
    onSuccess: (_, billId) => {
      // Immediately remove the deleted bill from cache — no refresh needed
      queryClient.setQueryData<BillSummary[]>(["/api/bills"], (old) =>
        old ? old.filter((b) => b._id !== billId) : []
      );
      // Remove the detail cache for the deleted bill
      queryClient.removeQueries({ queryKey: ["/api/bills", billId] });

      const remaining = (queryClient.getQueryData<BillSummary[]>(["/api/bills"]) ?? []);
      if (selectedBillId === billId) {
        setSelectedBillId(remaining[0]?._id ?? null);
      }
      setIsDeleteBillOpen(false);
      setBillToDeleteId(null);
      showSuccess("Bill deleted");
      hideLoader();
    },
    onError: (err: any) => {
      showError(err.message || "Failed to delete bill");
      hideLoader();
    },
  });

  const deleteAllBillsMutation = useMutation({
    mutationFn: async () => {
      showLoader();
      const res = await apiRequest("DELETE", "/api/bills/all");
      const data = await res.json().catch(() => ({}));
      return data as { deletedBills: number; deletedPayments: number };
    },
    onSuccess: (data) => {
      setSelectedBillId(null);
      setIsDeleteAllBillsOpen(false);
      queryClient.setQueryData(["/api/bills"], []);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === "/api/bills" && query.queryKey[1] != null });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      showSuccess(`All bills deleted. ${data.deletedBills} bill(s) and ${data.deletedPayments} payment record(s) removed from database.`);
      hideLoader();
    },
    onError: (err: any) => {
      showError(err.message || "Failed to delete all bills");
      hideLoader();
    },
  });

  const handleBackupBills = async () => {
    try {
      showLoader();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/bills/backup`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Backup failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `roomie-bills-backup-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Backup downloaded");
    } catch (err: any) {
      showError(err.message || "Failed to download backup");
    } finally {
      hideLoader();
    }
  };

  const updateBillMutation = useMutation({
    mutationFn: async ({ billId, data }: { billId: string; data: any }) => {
      showLoader();
      const res = await apiRequest("PATCH", `/api/bills/${billId}`, data);
      if (!res.ok) throw new Error("Failed to update bill");
      return res.json();
    },
    onSuccess: (data: BillDetail) => {
      // Immediately update the bill detail cache so the members table refreshes instantly
      queryClient.setQueryData(["/api/bills", data._id], data);
      // Also update the bills list to reflect new totalAmount/month/dueDate
      queryClient.setQueryData<BillSummary[]>(["/api/bills"], (old) =>
        old
          ? old.map((b) =>
              b._id === data._id
                ? {
                    ...b,
                    month: data.month,
                    year: data.year,
                    totalAmount: data.totalAmount,
                    splitAmount: data.splitAmount,
                    dueDate: data.dueDate,
                    entryDeductionEnabled: data.entryDeductionEnabled,
                    items: data.items,
                  }
                : b
            )
          : old
      );
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      showSuccess("Bill updated!");
      hideLoader();
    },
    onError: (err: any) => {
      showError(err.message || "Failed to update bill");
      hideLoader();
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      showLoader();
      const res = await apiRequest("PUT", "/api/payment-settings", settings);
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-settings"] });
      setIsSettingsOpen(false);
      showSuccess("Settings updated!");
      hideLoader();
    },
    onError: () => {
      showError("Failed to update settings");
      hideLoader();
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const updateBillItem = (index: number, field: "name" | "amount", value: string) =>
    setBillItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));

  const removeBillItem = (index: number) =>
    setBillItems(prev => prev.filter((_, i) => i !== index));

  const addCustomItem = () =>
    setBillItems(prev => [...prev, { name: "", amount: "" }]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <Header />
      <div className="min-h-screen bg-[#0f0f1f] pt-20 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

          {/* ── Page Header ── */}
          <div className="relative group mb-6">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur opacity-50 group-hover:opacity-75 transition" />
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl text-white font-bold flex items-center gap-3">
                  <Receipt className="w-7 h-7 text-[#9f5bf7]" />
                  Payments
                </h1>
                <p className="text-white/40 text-xs mt-1.5">
                  {isAdmin ? "You can create, edit, record payments & print. Others can view & print." : "You can view bills and print your invoice."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && (
                  <>
                    <Button
                      onClick={() => setIsCreateBillOpen(true)}
                      className="flex items-center gap-2 bg-[#582c84] hover:bg-[#6b35a0] text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Create Bill
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleBackupBills}
                      className="flex items-center gap-2 bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      title="Download all bills data as CSV backup (month-wise)"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Backup</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsDeleteAllBillsOpen(true)}
                      disabled={bills.length === 0}
                      className="flex items-center gap-2 bg-white/5 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      title="Permanently delete all bills from database"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Delete all bills</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsSettingsOpen(true)}
                      className="flex items-center gap-2 bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="hidden sm:inline">Settings</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Stats (shown when a bill is selected) ── */}
          {billDetail && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              <StatCard
                label="Bill Total"
                value={fmt(stats.total)}
                color="text-white"
                icon={<IndianRupee className="w-4 h-4 text-[#9f5bf7]" />}
              />
              <StatCard
                label="Received"
                value={fmt(stats.received)}
                color="text-green-400"
                icon={<TrendingUp className="w-4 h-4 text-green-400" />}
              />
              <StatCard
                label="Pending"
                value={fmt(stats.pending)}
                color="text-yellow-400"
                icon={<TrendingDown className="w-4 h-4 text-yellow-400" />}
              />
            </div>
          )}

          {/* ── Main Content ── */}
          {bills.length === 0 ? (
            <EmptyState isAdmin={isAdmin} onCreateBill={() => setIsCreateBillOpen(true)} />
          ) : (
            <div className="flex flex-col lg:flex-row gap-4">

              {/* ── Bills Sidebar ── */}
              <div className="lg:w-64 shrink-0">
                <div className="bg-[#151525] rounded-xl border border-white/5 overflow-hidden lg:sticky lg:top-24">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-white/40" />
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Monthly Bills</p>
                  </div>
                  {/* Date filter — styled dropdowns */}
                  <div className="px-3 py-2 border-b border-white/5 flex flex-wrap gap-2">
                    <select
                      value={filterYear}
                      onChange={e => setFilterYear(e.target.value)}
                      className="flex-1 min-w-0 rounded-lg bg-[#1c1b2d] border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#582c84] focus:border-[#582c84]/50 cursor-pointer transition-shadow"
                    >
                      <option value="">All years</option>
                      {yearOptions.map(y => (
                        <option key={y} value={String(y)} className="bg-[#1c1b2d] text-white">{y}</option>
                      ))}
                    </select>
                    <select
                      value={filterMonth}
                      onChange={e => setFilterMonth(e.target.value)}
                      className="flex-1 min-w-0 rounded-lg bg-[#1c1b2d] border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#582c84] focus:border-[#582c84]/50 cursor-pointer transition-shadow"
                    >
                      <option value="">All months</option>
                      {monthOptions.map(m => (
                        <option key={m} value={m} className="bg-[#1c1b2d] text-white">{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bills-list-scroll divide-y divide-white/5 max-h-[320px] lg:max-h-[640px] overflow-y-auto overscroll-contain">
                    {filteredBills.length === 0 ? (
                      <p className="px-4 py-6 text-white/40 text-sm text-center">No bills match filter</p>
                    ) : (
                      filteredBills.map(bill => (
                        <BillListItem
                          key={bill._id}
                          bill={bill}
                          isSelected={selectedBillId === bill._id}
                          onClick={() => setSelectedBillId(bill._id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* ── Bill Detail ── */}
              <div className="flex-1 min-w-0">
                {detailLoading ? (
                  <div className="bg-[#151525] rounded-xl border border-white/5 p-16 flex items-center justify-center">
                    <p className="text-white/30 text-sm animate-pulse">Loading bill details…</p>
                  </div>
                ) : billDetail ? (
                  <BillDetailView
                    bill={billDetail}
                    isAdmin={isAdmin}
                    currentUserId={user?._id}
                    onRecordPayment={(p) => { setRecordPayment(p); setRecordPaymentAmount(""); }}
                    onSendReminder={(id) => sendReminderMutation.mutate(id)}
                    onDeleteBill={() => { setBillToDeleteId(billDetail._id); setIsDeleteBillOpen(true); }}
                    onUpdateBill={(data) => updateBillMutation.mutate({ billId: billDetail._id, data })}
                    onEditError={showError}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Bill Dialog ── */}
      <Dialog open={isCreateBillOpen} onOpenChange={setIsCreateBillOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg w-full bg-[#151525] border border-[#582c84]/30 text-white max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#9f5bf7]" />
              Create Monthly Bill
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-white/50 text-xs uppercase tracking-wide">Expense Items</Label>
              {billItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Expense name"
                    value={item.name}
                    onChange={e => updateBillItem(index, "name", e.target.value)}
                    className="flex-1 bg-black/30 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-[#582c84]"
                  />
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-sm pointer-events-none">₹</span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.amount}
                      onChange={e => updateBillItem(index, "amount", e.target.value)}
                      className="pl-6 bg-black/30 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-[#582c84]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeBillItem(index)}
                    className="shrink-0 text-white/30 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={addCustomItem}
                className="w-full border border-dashed border-white/10 text-[#9f5bf7] hover:text-[#c08bff] hover:bg-[#582c84]/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Expense
              </Button>
            </div>

            <Separator className="bg-white/10" />

            {/* Total preview */}
            <div className="bg-[#1c1b2d] rounded-lg p-3 flex items-center justify-between">
              <span className="text-white/50 text-sm">Total Amount</span>
              <span className="text-white font-bold text-xl">₹{billTotal.toLocaleString()}</span>
            </div>

            {/* Entry deduction toggle */}
            <div className="flex items-center justify-between bg-[#1c1b2d] rounded-lg p-3">
              <div className="pr-4">
                <p className="text-white text-sm font-medium">Deduct approved entries</p>
                <p className="text-white/40 text-xs mt-0.5">
                  Each member's approved expenses are subtracted from their share
                </p>
              </div>
              <Switch
                checked={entryDeductionEnabled}
                onCheckedChange={setEntryDeductionEnabled}
                className="data-[state=checked]:bg-[#582c84] shrink-0"
              />
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label className="text-white/50 text-xs uppercase tracking-wide">Due on Day of Month</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={dueDays}
                onChange={e => setDueDays(parseInt(e.target.value) || 5)}
                className="bg-black/30 border-white/10 text-white focus-visible:ring-[#582c84]"
              />
              <p className="text-white/30 text-xs">Due date will be the {dueDays}{ordinal(dueDays)} of this month</p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsCreateBillOpen(false)}
              className="text-white/50 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createBillMutation.mutate()}
              disabled={createBillMutation.isPending || billTotal === 0}
              className="bg-[#582c84] hover:bg-[#6b35a0] text-white"
            >
              {createBillMutation.isPending ? "Creating…" : "Create Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={!!recordPayment} onOpenChange={o => !o && setRecordPayment(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-sm w-full bg-[#151525] border border-[#582c84]/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Record Payment</DialogTitle>
          </DialogHeader>

          {recordPayment && (() => {
            const totalDue = getEffectiveTotalDue(recordPayment);
            const alreadyPaid = recordPayment.paidAmount || 0;
            const remaining = Math.max(0, totalDue - alreadyPaid);
            return (
              <div className="space-y-4">
                {/* User card */}
                <div className="flex items-center gap-3 bg-[#1c1b2d] rounded-lg p-3">
                  <Avatar className="w-10 h-10 border border-[#582c84]/30">
                    <AvatarImage src={recordPayment.userId.profilePicture} />
                    <AvatarFallback className="bg-[#1a1a2e] text-white text-sm">
                      {getInitials(recordPayment.userId.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-medium">{recordPayment.userId.name}</p>
                    {recordPayment.userId.email && (
                      <p className="text-white/40 text-xs">{recordPayment.userId.email}</p>
                    )}
                  </div>
                </div>

                {/* Amounts grid */}
                <div className="grid grid-cols-3 gap-2">
                  <AmountBox label="Total Due" value={fmt(totalDue)} />
                  <AmountBox label="Paid" value={fmt(alreadyPaid)} valueClass="text-green-400" />
                  <AmountBox label="Remaining" value={fmt(remaining)} valueClass="text-yellow-400" highlight />
                </div>

                {/* Input */}
                <div className="space-y-1.5">
                  <Label className="text-white/50 text-xs uppercase tracking-wide">Amount Received (₹)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={remaining}
                    placeholder={`Up to ₹${remaining.toFixed(2)}`}
                    value={recordPaymentAmount}
                    onChange={e => setRecordPaymentAmount(e.target.value)}
                    className="bg-black/30 border-white/10 text-white focus-visible:ring-[#582c84]"
                    autoFocus
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRecordPayment(null)}
              className="text-white/50 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => recordPaymentMutation.mutate()}
              disabled={recordPaymentMutation.isPending || !recordPaymentAmount}
              className="bg-[#582c84] hover:bg-[#6b35a0] text-white"
            >
              {recordPaymentMutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ── */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm w-full bg-[#151525] border border-[#582c84]/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Payment Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/50 text-xs uppercase tracking-wide">Default Due Day (1–28)</Label>
              <Input
                type="number" min={1} max={28}
                value={settings.defaultDueDate}
                onChange={e => setSettings({ ...settings, defaultDueDate: parseInt(e.target.value) || 5 })}
                className="bg-black/30 border-white/10 text-white focus-visible:ring-[#582c84]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/50 text-xs uppercase tracking-wide">Late Penalty Per Day (₹)</Label>
              <Input
                type="number"
                value={settings.penaltyAmount}
                onChange={e => setSettings({ ...settings, penaltyAmount: parseInt(e.target.value) || 0 })}
                className="bg-black/30 border-white/10 text-white focus-visible:ring-[#582c84]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/50 text-xs uppercase tracking-wide">Reminder Frequency (days)</Label>
              <Input
                type="number"
                value={settings.reminderFrequency}
                onChange={e => setSettings({ ...settings, reminderFrequency: parseInt(e.target.value) || 3 })}
                className="bg-black/30 border-white/10 text-white focus-visible:ring-[#582c84]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsSettingsOpen(false)}
              className="text-white/50 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateSettingsMutation.mutate()}
              disabled={updateSettingsMutation.isPending}
              className="bg-[#582c84] hover:bg-[#6b35a0] text-white"
            >
              {updateSettingsMutation.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Bill Confirm ── */}
      <ConfirmDialog
        open={isDeleteBillOpen}
        onOpenChange={(open) => {
          setIsDeleteBillOpen(open);
          if (!open) setBillToDeleteId(null);
        }}
        title="Delete Bill?"
        description="This will permanently delete this bill and all its payment records from the database. This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => billToDeleteId && deleteBillMutation.mutate(billToDeleteId)}
      />

      {/* ── Delete ALL Bills Confirm ── */}
      <ConfirmDialog
        open={isDeleteAllBillsOpen}
        onOpenChange={setIsDeleteAllBillsOpen}
        title="Permanently delete all bills?"
        description={
          <>
            This will <strong>permanently delete all bills and all payment records</strong> for your flat from the database.
            This action cannot be undone. Make sure you have taken a backup if needed.
          </>
        }
        confirmText="Delete all permanently"
        cancelText="Cancel"
        onConfirm={() => deleteAllBillsMutation.mutate()}
      />

      {/* ── Mobile Nav ── */}
      <div className="block md:hidden fixed bottom-0 left-0 right-0 z-50">
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}

// ─── Helper: ordinal suffix ───────────────────────────────────────────────────

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label, value, color, icon,
}: {
  label: string; value: string; color: string; icon: React.ReactNode;
}) {
  return (
    <Card className="bg-[#151525] border border-white/5 text-white min-w-0">
      <CardContent className="pt-3 pb-3 px-3 sm:px-4">
        <div className="flex items-center justify-between mb-1.5 gap-1">
          <p className="text-white/40 text-xs font-medium truncate min-w-0">{label}</p>
          {icon}
        </div>
        <p className={cn("text-sm sm:text-lg font-bold break-all", color)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ isAdmin, onCreateBill }: { isAdmin: boolean; onCreateBill: () => void }) {
  return (
    <div className="bg-[#151525] rounded-xl border border-white/5 py-20 flex flex-col items-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-[#582c84]/20 flex items-center justify-center">
        <Receipt className="w-8 h-8 text-[#9f5bf7]" />
      </div>
      <div>
        <p className="text-white font-semibold text-lg">No Bills Yet</p>
        <p className="text-white/40 text-sm mt-1">
          {isAdmin
            ? "Create the first monthly bill to start tracking payments."
            : "No bills have been created yet."}
        </p>
      </div>
      {isAdmin && (
        <Button onClick={onCreateBill} className="bg-[#582c84] hover:bg-[#6b35a0] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create First Bill
        </Button>
      )}
    </div>
  );
}

function BillListItem({
  bill, isSelected, onClick,
}: {
  bill: BillSummary; isSelected: boolean; onClick: () => void;
}) {
  const dueStr = bill.dueDate ? format(new Date(bill.dueDate), "d MMM yyyy") : "";
  const status = bill.paymentStatus ?? "Pending";
  const isPaid = status === "Paid";
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors group",
        isSelected
          ? "bg-[#582c84]/30 text-white border-l-2 border-[#9f5bf7]"
          : "text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{bill.month} {bill.year}</p>
        <p className="text-xs opacity-50 mt-0.5">₹{bill.totalAmount.toLocaleString()}</p>
        {dueStr && <p className="text-[10px] opacity-40 mt-0.5">Due {dueStr}</p>}
      </div>
      <span
        className={cn(
          "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
          isPaid ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
        )}
      >
        {status}
      </span>
      <ChevronRight className={cn("w-4 h-4 shrink-0 opacity-30 transition-transform", isSelected && "opacity-60")} />
    </button>
  );
}

function BillDetailView({
  bill, isAdmin, currentUserId, onRecordPayment, onSendReminder, onDeleteBill, onUpdateBill, onEditError,
}: {
  bill: BillDetail;
  isAdmin: boolean;
  currentUserId?: string;
  onRecordPayment: (p: PaymentRecord) => void;
  onSendReminder: (id: string) => void;
  onDeleteBill?: () => void;
  onUpdateBill?: (data: { items: BillItem[]; totalAmount: number; month: string; year: number; dueDate: string; entryDeductionEnabled: boolean }) => void;
  onEditError?: (msg: string) => void;
}) {
  const [expenseOpen, setExpenseOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<FormBillItem[]>([]);
  const [editDueDate, setEditDueDate] = useState("");
  const [editEntryDeduction, setEditEntryDeduction] = useState(true);

  const startEdit = () => {
    setEditItems(bill.items?.length ? bill.items.map(i => ({ name: i.name, amount: String(i.amount) })) : [{ name: "", amount: "" }]);
    setEditDueDate(bill.dueDate ? format(new Date(bill.dueDate), "yyyy-MM-dd") : "");
    setEditEntryDeduction(bill.entryDeductionEnabled !== false);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const saveEdit = () => {
    const items = editItems.filter(i => i.name.trim() && parseFloat(i.amount) > 0).map(i => ({ name: i.name.trim(), amount: parseFloat(i.amount) }));
    if (items.length === 0) {
      onEditError?.("Add at least one expense item with amount");
      return;
    }
    const totalAmount = items.reduce((s, i) => s + i.amount, 0);
    onUpdateBill?.({
      items,
      totalAmount,
      month: bill.month,
      year: bill.year,
      dueDate: editDueDate ? new Date(editDueDate).toISOString() : bill.dueDate,
      entryDeductionEnabled: editEntryDeduction,
    });
    setIsEditing(false);
  };

  const pendingCount = bill.payments.filter(p => {
    const due = getEffectiveTotalDue(p);
    return (due - (p.paidAmount || 0)) > 0;
  }).length;

  const invFmt = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePrintInvoice = () => {
    const payment = currentUserId
      ? bill.payments.find(p => String(p.userId?._id ?? p.userId) === String(currentUserId))
      : bill.payments[0];
    const totalDue = payment ? getEffectiveTotalDue(payment) : 0;
    const paid = payment?.paidAmount ?? 0;
    const remaining = Math.max(0, totalDue - paid);
    const baseAmount = payment?.amount ?? 0;
    const carryForward = payment?.carryForwardAmount ?? 0;
    const entryDed = payment?.entryDeduction ?? 0;
    const dueDateObj = bill.dueDate ? new Date(bill.dueDate) : null;
    const dueStr = dueDateObj && !isNaN(dueDateObj.getTime())
      ? format(dueDateObj, "EEEE, do MMMM yyyy")
      : "—";
    const generatedAt = format(new Date(), "do MMMM yyyy 'at' hh:mm a");
    const userName = payment?.userId?.name ?? "Member";
    const logoUrl = typeof window !== "undefined" ? window.location.origin + "/static/images/Roomie.png" : "";

    const baseStyles = `
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 0; padding: 0; color: #111; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice { max-width: 100%; margin: 0; padding: 10px 12px; }
    .brand { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #111; }
    .brand-left { display: flex; align-items: center; gap: 10px; }
    .brand img.logo-img { height: 36px; width: auto; max-width: 140px; object-fit: contain; display: block; }
    .logo-fallback { display: flex; align-items: center; gap: 6px; }
    .logo-box { width: 36px; height: 36px; background: #1a1a1a; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .logo-box svg { width: 20px; height: 20px; }
    .brand-text { font-size: 18px; font-weight: 800; color: #111; letter-spacing: 0.06em; }
    .brand-tag { font-size: 9px; color: #333; letter-spacing: 0.04em; margin-top: 0; }
    .invoice-label { font-size: 9px; font-weight: 700; color: #111; letter-spacing: 0.1em; text-align: right; }
    .invoice-period { font-size: 14px; font-weight: 700; color: #111; margin-top: 1px; }
    .bill-head { background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; }
    .bill-title { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px 0; }
    .bill-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: #222; }
    .bill-meta span { display: flex; align-items: center; gap: 4px; }
    .bill-meta strong { color: #111; }
    .section-head { font-size: 10px; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    table.expenses thead th { background: #eee; padding: 4px 8px; border: 1px solid #ddd; color: #111; font-weight: 600; }
    table.expenses th, table.expenses td { padding: 4px 8px; text-align: left; border-bottom: 1px solid #e5e5e5; color: #111; }
    table.expenses .amount { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
    table.expenses .total-row td { font-weight: 700; background: #eee; padding: 5px 8px; color: #111; border-bottom: 2px solid #ddd; }
    table.expenses .per-person { font-size: 10px; color: #333; }
    .members-table { font-size: 10px; }
    .members-table th, .members-table td { padding: 3px 6px; border: 1px solid #ddd; color: #111; }
    .members-table thead th { background: #eee; font-weight: 600; }
    .members-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .members-table .penalty { color: #b91c1c; font-weight: 500; }
    .your-payment { background: #1a1a1a; color: #fff; border-radius: 8px; padding: 10px 12px; margin-top: 4px; }
    .your-payment .name { font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #fff; }
    .pay-row { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; font-size: 11px; }
    .pay-row.emphasis { font-weight: 700; font-size: 12px; padding-top: 6px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); }
    .pay-row .label, .pay-row .value { color: #fff; }
    .pay-row .value.penalty-val { color: #fca5a5; }
    .footer { margin-top: 8px; padding-top: 6px; border-top: 1px solid #ddd; font-size: 10px; color: #333; text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 8mm; }
      .invoice { page-break-inside: avoid; padding: 6px 8px; }
      .invoice-wrap { break-inside: avoid; }
    }
    `;

    const memberRows = bill.payments.map((p: PaymentRecord) => {
      const due = getEffectiveTotalDue(p);
      const rem = Math.max(0, due - (p.paidAmount ?? 0));
      const pen = p.penaltyWaived ? 0 : (p.penalty ?? 0);
      const name = p.userId?.name ?? "Member";
      return `<tr>
        <td>${name}</td>
        <td class="num">₹${invFmt(p.amount ?? 0)}</td>
        <td class="num">−₹${invFmt(p.entryDeduction ?? 0)}</td>
        <td class="num">${(p.carryForwardAmount ?? 0) > 0 ? "+₹" + invFmt(p.carryForwardAmount) : "—"}</td>
        <td class="num penalty">${pen > 0 ? "+₹" + invFmt(pen) : "—"}</td>
        <td class="num">₹${invFmt(due)}</td>
        <td class="num">₹${invFmt(p.paidAmount ?? 0)}</td>
        <td class="num">₹${invFmt(rem)}</td>
      </tr>`;
    }).join("");

    const adminInvoiceBody = isAdmin ? `
    <div class="section-head">Member payments</div>
    <table class="expenses members-table">
      <thead><tr><th>Member</th><th class="num">Base</th><th class="num">Entry ded.</th><th class="num">Carry fwd</th><th class="num">Penalty</th><th class="num">Total due</th><th class="num">Paid</th><th class="num">Remaining</th></tr></thead>
      <tbody>${memberRows}</tbody>
    </table>` : `
    <div class="section-head">Your payment</div>
    <div class="your-payment">
      <div class="name">${userName}</div>
      ${baseAmount > 0 ? `<div class="pay-row"><span class="label">Base share</span><span class="value">₹${invFmt(baseAmount)}</span></div>` : ""}
      ${entryDed !== 0 ? `<div class="pay-row"><span class="label">Entry deduction</span><span class="value">−₹${invFmt(Math.abs(entryDed))}</span></div>` : ""}
      ${carryForward > 0 ? `<div class="pay-row"><span class="label">Carry forward</span><span class="value">+₹${invFmt(carryForward)}</span></div>` : ""}
      ${!payment?.penaltyWaived && (payment?.penalty ?? 0) > 0 ? `<div class="pay-row"><span class="label">Penalty</span><span class="value penalty-val">+₹${invFmt(payment?.penalty ?? 0)}</span></div>` : ""}
      <div class="pay-row"><span class="label">Total due</span><span class="value">₹${invFmt(totalDue)}</span></div>
      <div class="pay-row"><span class="label">Paid</span><span class="value">₹${invFmt(paid)}</span></div>
      <div class="pay-row emphasis"><span class="label">Remaining</span><span class="value">₹${invFmt(remaining)}</span></div>
    </div>`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice — ${bill.month} ${bill.year} · Roomie</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="invoice invoice-wrap">
    <header class="brand">
      <div class="brand-left">
        <img src="${logoUrl}" alt="Roomie" class="logo-img" onerror="this.style.display='none'; var f=document.getElementById('brand-fallback'); if(f) f.style.display='flex';" />
        <div id="brand-fallback" class="logo-fallback" style="display:none;">
          <div class="logo-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div class="brand-text">ROOMIE</div>
            <div class="brand-tag">Shared living · Bills &amp; payments</div>
          </div>
        </div>
      </div>
      <div>
        <div class="invoice-label">INVOICE</div>
        <div class="invoice-period">${bill.month} ${bill.year}</div>
      </div>
    </header>

    <div class="bill-head">
      <h1 class="bill-title">Bill — ${bill.month} ${bill.year}</h1>
      <div class="bill-meta">
        <span><strong>Due:</strong> ${dueStr}</span>
        <span><strong>Members:</strong> ${bill.payments.length}</span>
        ${bill.entryDeductionEnabled ? '<span><strong>Entry deduction:</strong> On</span>' : ""}
      </div>
    </div>

    <div class="section-head">Expense breakdown</div>
    <table class="expenses">
      <thead><tr><th>Item</th><th class="amount">Amount (₹)</th></tr></thead>
      <tbody>
        ${bill.items.map((i: BillItem) => `<tr><td>${i.name}</td><td class="amount">${i.amount.toLocaleString("en-IN")}</td></tr>`).join("")}
        <tr class="total-row"><td>Total</td><td class="amount">₹${bill.totalAmount.toLocaleString("en-IN")}</td></tr>
        <tr class="per-person"><td>Per person (${bill.payments.length} members)</td><td class="amount">₹${invFmt(bill.splitAmount)}</td></tr>
      </tbody>
    </table>
    ${adminInvoiceBody}
    <p class="footer">Generated from Roomie on ${generatedAt}</p>
  </div>
</body>
</html>`;

    // Use iframe for reliable print on mobile (avoids pop-up block and "problem printing" errors)
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Invoice print");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;overflow:hidden;clip:rect(0,0,0,0);";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    const printFrame = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Fallback: open in new window for browsers that restrict iframe print
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => { win.print(); }, 500);
        }
      }
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    };

    // Wait for content and images to be ready (longer on mobile)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const delay = isMobile ? 800 : 400;
    setTimeout(printFrame, delay);
  };

  return (
    <div className="space-y-4">
      {/* ── Bill Header card (or edit form) ── */}
      <div className="bg-[#151525] rounded-xl border border-white/5 p-4">
        {isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-white/50 text-xs uppercase">Edit bill</Label>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-white/60 hover:text-white h-8">
                  <X className="w-3.5 h-3.5 mr-1" />Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} className="bg-[#582c84] hover:bg-[#6b35a0] text-white h-8">
                  <Pencil className="w-3.5 h-3.5 mr-1" />Save
                </Button>
              </div>
            </div>
            <Label className="text-white/50 text-xs uppercase">Expense items</Label>
            {editItems.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <Input placeholder="Name" value={item.name} onChange={e => setEditItems(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} className="flex-1 bg-black/30 border-white/10 text-white" />
                <Input type="number" placeholder="Amount" value={item.amount} onChange={e => setEditItems(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} className="w-28 bg-black/30 border-white/10 text-white" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))} className="text-white/40 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditItems(prev => [...prev, { name: "", amount: "" }])} className="text-[#9f5bf7]">+ Add item</Button>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-white/50 text-xs">Due date</Label>
                <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="bg-black/30 border-white/10 text-white w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editEntryDeduction} onCheckedChange={setEditEntryDeduction} className="data-[state=checked]:bg-[#582c84]" />
                <Label className="text-white/70 text-sm">Deduct approved entries</Label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-white text-xl font-bold">Bill — {bill.month} {bill.year}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="flex items-center gap-1.5 text-[#9f5bf7] text-sm font-medium">
                  <CalendarDays className="w-4 h-4" />
                  Due {bill.dueDate ? format(new Date(bill.dueDate), "do MMMM yyyy") : "—"}
                </span>
                <span className="flex items-center gap-1.5 text-white/40 text-xs">
                  <Users className="w-3.5 h-3.5" />
                  {bill.payments.length} members
                </span>
                {bill.entryDeductionEnabled && (
                  <span className="text-[10px] bg-[#582c84]/20 text-[#9f5bf7] px-2 py-0.5 rounded-full border border-[#582c84]/20">
                    Entry deduction on
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-1">
                {isAdmin && (onDeleteBill || onUpdateBill) && (
                  <>
                    {onUpdateBill && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={startEdit}
                            className="h-9 w-9 text-[#9f5bf7] hover:bg-[#582c84]/20 hover:text-[#9f5bf7]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-[#1c1b2d] border-white/10 text-white">
                          Edit bill (Admin)
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {onDeleteBill && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onDeleteBill}
                            className="h-9 w-9 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-[#1c1b2d] border-white/10 text-white">
                          Delete bill (Admin)
                        </TooltipContent>
                      </Tooltip>
                    )}

                  </>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handlePrintInvoice}
                      className="h-9 w-9 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[#1c1b2d] border-white/10 text-white">
                    Print invoice
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-xs">Total</p>
                <p className="text-white font-bold text-2xl">₹{bill.totalAmount.toLocaleString()}</p>
                <p className="text-[#9f5bf7] text-sm mt-0.5">₹{bill.splitAmount.toFixed(2)}/person</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Expense Breakdown ── */}
      <div className="bg-[#151525] rounded-xl border border-white/5 overflow-hidden">
        <button
          onClick={() => setExpenseOpen(!expenseOpen)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-white/60 text-sm font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Expense Breakdown
          </span>
          <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform", expenseOpen && "rotate-180")} />
        </button>

        {expenseOpen && (
          <div className="p-4">
            <div className="space-y-2">
              {bill.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-white/70 text-sm">{item.name}</span>
                  <span className="text-[#9f5bf7] font-medium text-sm">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <Separator className="bg-white/10 my-3" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-semibold">Grand Total</span>
                <span className="text-white font-bold">₹{bill.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs">Per person ({bill.payments.length} members)</span>
                <span className="text-[#9f5bf7] font-semibold text-sm">₹{bill.splitAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Member Payments — Desktop Table ── */}
      <div className="hidden md:block bg-[#151525] rounded-xl border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
          <Users className="w-4 h-4 text-white/40" />
          <p className="text-white/60 text-sm font-semibold">Member Payments</p>
        </div>
        <div className="members-table-scroll overflow-x-auto overflow-y-auto max-h-[min(65vh,32rem)] relative">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-[#151525] border-b border-white/5 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
              <tr className="bg-[#1a1a2d]">
                <th className="text-left text-white/40 font-medium px-4 py-2.5 whitespace-nowrap">Member</th>
                <th className="text-right text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">Base</th>
                {bill.entryDeductionEnabled && (
                  <th className="text-right text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">
                    Entry Ded.
                  </th>
                )}
                <th className="text-right text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">Carry Fwd</th>
                <th className="text-right text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">Penalty</th>
                <th className="text-right text-white/40 font-medium px-3 py-2.5 whitespace-nowrap bg-white/[0.03]">
                  Total Due
                </th>
                <th className="text-right text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">Paid</th>
                <th className="text-right text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">Remaining</th>
                <th className="text-center text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">Status</th>
                {isAdmin && (
                  <th className="text-center text-white/40 font-medium px-3 py-2.5 whitespace-nowrap">Actions (Admin)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {bill.payments.map(payment => {
                const totalDue = getEffectiveTotalDue(payment);
                const paid = payment.paidAmount || 0;
                const remaining = Math.max(0, totalDue - paid);
                const isCurrentUser = payment.userId._id === currentUserId;

                return (
                  <tr
                    key={payment._id}
                    className={cn(
                      "transition-colors hover:bg-white/[0.02]",
                      isCurrentUser && "bg-[#582c84]/10"
                    )}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 border border-[#582c84]/30 shrink-0">
                          <AvatarImage src={payment.userId.profilePicture} />
                          <AvatarFallback className="bg-[#1a1a2e] text-white text-xs">
                            {getInitials(payment.userId.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-white font-medium">
                          {payment.userId.name}
                          {isCurrentUser && (
                            <span className="ml-1.5 text-[10px] bg-[#582c84]/30 text-[#9f5bf7] px-1.5 py-0.5 rounded-full">
                              You
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right text-white/60 whitespace-nowrap">
                      ₹{payment.amount.toFixed(2)}
                    </td>

                    {bill.entryDeductionEnabled && (
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {payment.entryDeduction > 0
                          ? <span className="text-green-400">−₹{payment.entryDeduction.toFixed(2)}</span>
                          : <span className="text-white/20">—</span>}
                      </td>
                    )}

                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {payment.carryForwardAmount > 0
                        ? <span className="text-orange-400">+₹{payment.carryForwardAmount.toFixed(2)}</span>
                        : <span className="text-white/20">—</span>}
                    </td>

                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {!payment.penaltyWaived && (payment.penalty ?? 0) > 0
                        ? <span className="text-red-400">+₹{(payment.penalty ?? 0).toFixed(2)}</span>
                        : <span className="text-white/20">—</span>}
                    </td>

                    <td className="px-3 py-3 text-right whitespace-nowrap bg-white/[0.02]">
                      <span className="text-white font-semibold">₹{totalDue.toFixed(2)}</span>
                    </td>

                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-green-400">₹{paid.toFixed(2)}</span>
                    </td>

                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className={cn("font-semibold", remaining > 0 ? "text-yellow-400" : "text-green-400")}>
                        ₹{remaining.toFixed(2)}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <PaymentStatusBadge status={payment.status} remaining={remaining} />
                    </td>

                    {isAdmin && (
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 min-w-[120px]">
                          {remaining > 0 ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onRecordPayment(payment)}
                                className="h-7 px-2.5 text-xs bg-transparent border-[#582c84]/60 text-[#9f5bf7] hover:bg-[#582c84]/20 hover:text-white hover:border-[#9f5bf7]"
                              >
                                Record
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onSendReminder(payment._id)}
                                className="h-7 w-7 p-0 text-white/30 hover:text-[#9f5bf7] hover:bg-[#582c84]/20"
                                title="Send payment reminder"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </Button>

                            </>
                          ) : (
                            <span className="text-xs font-medium text-green-400/90 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20">
                              All paid
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Member Payments — Mobile Cards ── */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Users className="w-4 h-4 text-white/40" />
          <p className="text-white/60 text-sm font-semibold">Member Payments</p>
        </div>

        {bill.payments.map(payment => {
          const totalDue = getEffectiveTotalDue(payment);
          const paid = payment.paidAmount || 0;
          const remaining = Math.max(0, totalDue - paid);
          const isCurrentUser = payment.userId._id === currentUserId;

          return (
            <div
              key={payment._id}
              className={cn(
                "bg-[#151525] rounded-xl border border-white/5 p-4 space-y-3",
                isCurrentUser && "border-[#582c84]/40 bg-[#582c84]/5"
              )}
            >
              {/* User row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9 border border-[#582c84]/30">
                    <AvatarImage src={payment.userId.profilePicture} />
                    <AvatarFallback className="bg-[#1a1a2e] text-white text-xs">
                      {getInitials(payment.userId.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-medium text-sm">{payment.userId.name}</p>
                    {isCurrentUser && (
                      <p className="text-[#9f5bf7] text-[10px]">You</p>
                    )}
                  </div>
                </div>
                <PaymentStatusBadge status={payment.status} remaining={remaining} />
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-2">
                <MobileAmountBox label="Base" value={`₹${payment.amount.toFixed(2)}`} />
                {bill.entryDeductionEnabled && payment.entryDeduction > 0 && (
                  <MobileAmountBox
                    label="Entry Deduction"
                    value={`−₹${payment.entryDeduction.toFixed(2)}`}
                    valueClass="text-green-400"
                  />
                )}
                {payment.carryForwardAmount > 0 && (
                  <MobileAmountBox
                    label="Carry Forward"
                    value={`+${fmt(payment.carryForwardAmount)}`}
                    valueClass="text-orange-400"
                  />
                )}
                {!payment.penaltyWaived && (payment.penalty ?? 0) > 0 && (
                  <MobileAmountBox
                    label="Penalty"
                    value={`+${fmt(payment.penalty ?? 0)}`}
                    valueClass="text-red-400"
                  />
                )}
                <MobileAmountBox
                  label="Total Due"
                  value={fmt(totalDue)}
                  valueClass="text-white font-semibold"
                />
                <MobileAmountBox
                  label="Paid"
                  value={`₹${paid.toFixed(2)}`}
                  valueClass="text-green-400"
                />
                <MobileAmountBox
                  label="Remaining"
                  value={`₹${remaining.toFixed(2)}`}
                  valueClass={remaining > 0 ? "text-yellow-400 font-semibold" : "text-green-400"}
                />
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {remaining > 0 ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => onRecordPayment(payment)}
                        className="flex-1 bg-[#582c84] hover:bg-[#6b35a0] text-white h-8 text-xs"
                      >
                        Record Payment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSendReminder(payment._id)}
                        className="h-8 px-3 bg-transparent border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                        title="Send reminder"
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </Button>

                    </>
                  ) : (
                    <span className="text-xs font-medium text-green-400/90 bg-green-500/10 px-3 py-1.5 rounded-md border border-green-500/20 w-full text-center">
                      All paid
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tiny shared sub-components ──────────────────────────────────────────────

function PaymentStatusBadge({ status, remaining }: { status: string; remaining: number }) {
  const isPaid = status === "PAID" || remaining === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium",
        isPaid
          ? "bg-green-500/10 text-green-400 border-green-500/20"
          : "bg-white/5 text-amber-400 border-amber-500/20"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", isPaid ? "bg-green-400" : "bg-amber-400 animate-pulse")} />
      {isPaid ? "Paid" : "Pending"}
    </span>
  );
}

function AmountBox({
  label, value, valueClass, highlight,
}: {
  label: string; value: string; valueClass?: string; highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg p-3 text-center", highlight ? "bg-[#582c84]/15 border border-[#582c84]/30" : "bg-[#1c1b2d]")}>
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className={cn("font-bold text-white", valueClass)}>{value}</p>
    </div>
  );
}

function MobileAmountBox({
  label, value, valueClass,
}: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="bg-[#1c1b2d] rounded-lg px-3 py-2">
      <p className="text-white/40 text-xs mb-0.5">{label}</p>
      <p className={cn("text-sm font-medium text-white", valueClass)}>{value}</p>
    </div>
  );
}
