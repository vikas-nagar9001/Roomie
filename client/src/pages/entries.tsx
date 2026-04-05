import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LuUserPlus } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { Loader2, PanelRight, Receipt } from "lucide-react";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { showSuccess, showError, showInfo, showWarning } from "@/services/toastService";
import { Link } from "wouter";
import favicon from "../../Roomie.png";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { Entry } from "@shared/schema";
import CreatableSelect from "react-select/creatable";
import { FaUserCircle, FaEdit, FaTrash, FaClipboardList, FaSearch } from "react-icons/fa";
import { CustomPagination } from "@/components/custom-pagination";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContributionStatus } from "@/components/contribution-status";
import { BsThreeDots } from "react-icons/bs";
import { useMonthLock } from "@/hooks/use-month-lock";
import {
  MONTH_LOCKED_MESSAGE,
  monthLockActionAria,
  monthLockBlockTooltip,
} from "@/constants/month-lock";
import {
  MonthLockIcon,
  MonthLockedBanner,
  MonthLockStatusSkeleton,
  MonthLockUnavailableBanner,
  lockedRowClassName,
  monthLockWaitCursor,
} from "@/components/month-lock-ui";
import { cn } from "@/lib/utils";
import { accountingMonthKeyFromDate, entryAccountingMonthKey } from "@/lib/accounting-month";

const getInitials = (name: string | undefined) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

// Create a separate component for editing an entry.
function EditEntryDialog({ entry, ledgerLocked }: { entry: Entry; ledgerLocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const handleDelete = async () => {
    showLoader();
    try {
      await apiRequest("DELETE", `/api/entries/${entry._id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      showSuccess(`Entry "${entry.name}" has been deleted successfully.`);
      setDeleteDialogOpen(false);
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Failed to delete entry";
      showError(msg);
    } finally {
      hideLoader();
    }
  };

  if (ledgerLocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/40 cursor-default">
            <MonthLockIcon className="text-[13px]" />
            <FaEdit className="text-sm opacity-50" />
            Locked
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px] bg-[#1c1b2d] border border-white/10 text-white text-xs">
          {MONTH_LOCKED_MESSAGE}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center space-x-2">
          <DialogTrigger asChild>
            {/* ✏️ Edit Button with Icon */}
            <button
              className="p-1.5 text-[#582c84] hover:bg-white/5 rounded-full transition-all duration-200"
              onClick={() => setOpen(true)}
            >
              <FaEdit className="text-lg" />
            </button>
          </DialogTrigger>
          {/* 🗑️ Delete Button with Icon */}
          <button
            className="p-1.5 text-red-500/80 hover:bg-white/5 hover:text-red-500 rounded-full transition-all duration-200"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <FaTrash className="text-lg" />
          </button>
        </div>

        <DialogContent className="top-[60vh] max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Edit Entry</DialogTitle>
          </DialogHeader>          <form onSubmit={async (e) => {
            e.preventDefault();
            showLoader();
            const formData = new FormData(e.currentTarget);
            try {
              await apiRequest("PATCH", `/api/entries/${entry._id}`, {
                name: formData.get("name"),
                amount: parseFloat(formData.get("amount") as string),
              });
              queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
              queryClient.invalidateQueries({ queryKey: ["/api/entries/total"] });
              queryClient.invalidateQueries({ queryKey: ["/api/history"] });
              showSuccess(`Entry "${entry.name}" has been updated successfully.`);
              setOpen(false);
            } catch (error: unknown) {
              console.error(error);
              const msg = error instanceof Error ? error.message : "Failed to update entry";
              showError(msg);
            } finally {
              hideLoader();
            }
          }}
            className="space-y-4"
          >
            <Input
              name="name"
              defaultValue={entry.name}
              placeholder="Entry Name"
              className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
            />
            <Input
              name="amount"
              type="number"
              defaultValue={entry.amount}
              placeholder="Amount"
              className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
            />

            <Button
              type="submit"
              className="w-full bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg"
            >
              Update Entry
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Entry"
        description={`Are you sure you want to delete the entry "${entry.name.length > 15 ? entry.name.substring(0, 15) + '...' : entry.name}"?\nThis action cannot be undone and the entry will be permanently removed.`}
        onConfirm={handleDelete}
        confirmText="Delete Entry"
        cancelText="Cancel"
      />
    </>
  );
}



export default function EntriesPage() {
  const { user, logoutMutation } = useAuth();
  const {
    isLocked,
    monthStatus,
    gateReason,
    interactionDisabled,
    rowLooksLocked,
  } = useMonthLock();
  const [newEntry, setNewEntry] = useState({ name: "", amount: "" });
  const [openAddDialog, setOpenAddDialog] = useState(false); // State for controlling the Add Entry dialog

  useEffect(() => {
    if (openAddDialog) {
      setNewEntry({ name: "", amount: "" });
    }
  }, [openAddDialog]);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 6; // Limit of 10 per page
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showContributionStatus, setShowContributionStatus] = useState(false);
  const [contributionSheetOpen, setContributionSheetOpen] = useState(false);

  const [isMdUp, setIsMdUp] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      const up = mq.matches;
      setIsMdUp(up);
      if (up) {
        setContributionSheetOpen(false);
        setOpenAddDialog(false);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const updateEntryStatusInCache = (entryId: string, status: "APPROVED" | "REJECTED") => {
    queryClient.setQueryData<Entry[]>(["/api/entries"], (old) => {
      if (!old) return old;
      return old.map((e) => (e && (e as any)._id === entryId ? ({ ...(e as any), status } as any) : e));
    });
  };

  const approveRejectMutation = useMutation({
    mutationFn: async ({ entryId, status }: { entryId: string; status: "APPROVED" | "REJECTED" }) => {
      showLoader();
      const route = status === "APPROVED" ? "approved" : "rejected";
      const res = await apiRequest("POST", `/api/entries/${entryId}/${route}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.message || "Failed to update entry");
      return { entryId, status };
    },
    onMutate: async ({ entryId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/entries"] });
      const prev = queryClient.getQueryData<Entry[]>(["/api/entries"]);
      updateEntryStatusInCache(entryId, status);
      return { prev };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/entries"], ctx.prev);
      showError(err?.message || "Failed to update entry status");
      hideLoader();
    },
    onSuccess: ({ status }) => {
      showSuccess(status === "APPROVED" ? "Entry approved" : "Entry rejected");
      queryClient.invalidateQueries({ queryKey: ["/api/entries"], exact: true });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/total"], exact: true });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      hideLoader();
    },
  });

  // Effect to reset selected entries when search query is cleared
  useEffect(() => {
    if (!searchQuery) {
      setSelectedEntries([]);
    }
  }, [searchQuery]);

  // Show loader when the component mounts and set up cleanup
  useEffect(() => {
    showLoader();

    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);

  // Manage loading state
  useEffect(() => {
    if (!dataLoading) {
      hideLoader();
    }
  }, [dataLoading]);
  const { data: entries } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
    queryFn: getQueryFn({ on401: "throw" }),
    onSettled: () => {
      setDataLoading(false);
    }
  });

  const { data: totals } = useQuery<{ userTotal: number; flatTotal: number; fairSharePercentage: number; fairShareAmount: number; userContributionPercentage: number; isDeficit: boolean }>({
    queryKey: ["/api/entries/total"],
    onSuccess: () => {
      setDataLoading(false);
    },
    onError: () => {
      setDataLoading(false);
    }
  });



  /////////////penalty data///////////////
  // all user penalty total  
  const [allUserPenalties, setPenalties] = useState<{ [userId: string]: { totalAmount: number; entries: number } }>({});
  const [totalPenaltyAmount, setTotalAmount] = useState(0);
  const [totalPenaltyEntries, setTotalEntries] = useState(0); useEffect(() => {
    const fetchPenalties = async () => {
      try {
        // Loader is already shown from component mount
        const response = await fetch("/api/penalties");
        const data = await response.json();

        // Initialize maps
        const penaltyMap: { [userId: string]: { totalAmount: number; entries: number } } = {};
        let overallTotalAmount = 0;
        let overallTotalEntries = 0;

        data.forEach((penalty: { userId: { _id: string }; amount: number }) => {
          const userId = penalty.userId?._id; // Extract userId from object
          if (!userId) return; // Skip if userId is missing

          if (!penaltyMap[userId]) {
            penaltyMap[userId] = { totalAmount: 0, entries: 0 };
          }

          penaltyMap[userId].totalAmount += penalty.amount;
          penaltyMap[userId].entries += 1;

          // Update overall totals
          overallTotalAmount += penalty.amount;
          overallTotalEntries += 1;
        });
        setPenalties(penaltyMap);
        setTotalAmount(overallTotalAmount);
        setTotalEntries(overallTotalEntries);
        setDataLoading(false);
      } catch (error) {
        console.error("Error fetching penalties:", error);
        setDataLoading(false);
      }
    };

    fetchPenalties();
  }, []);


  /////////////penalty data///////////////////////


  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  // Function to handle selecting/deselecting all entries
  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredEntries) {
      const filteredIds = filteredEntries
        .filter((entry: Entry) => !interactionDisabled(entryAccountingMonthKey(entry)))
        .map((entry: Entry) => entry._id);
      setSelectedEntries(filteredIds);
    } else {
      setSelectedEntries([]);
    }
  };

  // Function to handle selecting/deselecting a single entry
  const handleSelectEntry = (entryId: string, checked: boolean) => {
    if (checked) {
      const row = filteredEntries?.find((entry: Entry) => entry._id === entryId);
      if (row && interactionDisabled(entryAccountingMonthKey(row))) return;
      if (filteredEntries?.some((entry: Entry) => entry._id === entryId)) {
        setSelectedEntries((prev) => [...prev, entryId]);
      }
    } else {
      setSelectedEntries((prev) => prev.filter((id) => id !== entryId));
    }
  };

  // Function to handle bulk deletion
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = () => {
    if (selectedEntries.length === 0) return;

    setBulkDeleteDialogOpen(true);
  };   const confirmBulkDelete = () => {
    if (anySelectedIncludesLockedMonth) {
      showWarning(MONTH_LOCKED_MESSAGE);
      setBulkDeleteDialogOpen(false);
      return;
    }
    showLoader();
    setDataLoading(true);

    fetch('/api/entries/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds: selectedEntries }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
        queryClient.invalidateQueries({ queryKey: ["/api/entries/total"] });
        queryClient.invalidateQueries({ queryKey: ["/api/history"] });

        showSuccess(`${selectedEntries.length} entries have been deleted successfully.`);

        setSelectedEntries([]);
        setBulkDeleteDialogOpen(false);
        setDataLoading(false); // Ensure loader is hidden
        hideLoader(); // Hide loader after successful deletion
      })
      .catch(error => {
        console.error("Failed to delete entries:", error);
        showError("Failed to delete entries. Please try again.");
        setBulkDeleteDialogOpen(false);
        setDataLoading(false); // Ensure loader is hidden
        hideLoader(); // Hide loader on error
      });
  };


  // Filter and sort entries
  const filteredEntries = entries?.filter((entry: Entry) => {
    if (!searchQuery) return true;
    
    const searchText = searchQuery.toLowerCase();
    const entryDate = new Date(entry.dateTime).toLocaleDateString();
    
    return (
      // Search by entry name
      entry.name.toLowerCase().includes(searchText) ||
      // Search by amount
      entry.amount.toString().includes(searchText) ||
      // Search by user name
      (typeof entry.userId === 'object' && entry.userId?.name?.toLowerCase().includes(searchText)) ||
      // Search by status
      entry.status.toLowerCase().includes(searchText) ||
      // Search by date
      entryDate.toLowerCase().includes(searchText)
    );
  });

  const selectableFilteredEntries = useMemo(
    () =>
      (filteredEntries ?? []).filter(
        (entry: Entry) => !interactionDisabled(entryAccountingMonthKey(entry))
      ),
    [filteredEntries, interactionDisabled]
  );

  const currentCalendarMonthKey = accountingMonthKeyFromDate(new Date());
  const addEntryBlocked = interactionDisabled(currentCalendarMonthKey);

  const anySelectedIncludesLockedMonth = useMemo(() => {
    if (!entries?.length || !selectedEntries.length) return false;
    for (const id of selectedEntries) {
      const e = entries.find((x) => x._id === id);
      if (e && isLocked(entryAccountingMonthKey(e))) return true;
    }
    return false;
  }, [entries, selectedEntries, isLocked]);

  const isAdmin = user?.role === "ADMIN" || user?.role === "CO_ADMIN";

  const hasCurrentUserContributionWarning = useMemo(() => {
    if (!entries?.length || !users?.length || !user?._id) return false;
    const currentUserId = user._id.toString();
    const totalApprovedGlobal =
      entries
        .filter((e) => e.status === "APPROVED")
        .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
    const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
    if (totalGlobalAfterPenalty <= 0) return false;
    const fairSharePerUser = totalGlobalAfterPenalty / users.length;
    const userEntries = entries.filter((e) => {
      const entryUserId =
        typeof e.userId === "object" && e.userId !== null
          ? (e.userId._id || e.userId.id || e.userId)
          : e.userId;
      return entryUserId?.toString() === currentUserId;
    });
    const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
    const userPenaltyAmount = allUserPenalties[currentUserId]?.totalAmount || 0;
    const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const totalAmountAfterPenalty = totalApprovedAmount - userPenaltyAmount;
    const fairSharePercentage = 100 / users.length;
    const userContributionPercentage =
      totalGlobalAfterPenalty > 0 ? (totalAmountAfterPenalty / totalGlobalAfterPenalty) * 100 : 0;
    const fairShareThreshold = (75 * fairSharePercentage) / 100;
    return (
      fairSharePerUser > 0 &&
      totalAmountAfterPenalty > 0 &&
      userContributionPercentage < fairShareThreshold
    );
  }, [entries, users, user?._id, totalPenaltyAmount, allUserPenalties]);

  const handleRunContributionCheck = async () => {
    showLoader();
    setDataLoading(true);
    try {
      const res = await fetch("/api/check-contribution-penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipAdmins: false }),
      });
      const data = await res.json();
      if (data.deficitUsers?.length > 0) {
        showWarning(data.message);
      } else {
        showSuccess(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/total"] });
    } catch {
      showError("Failed to run contribution check");
    } finally {
      setDataLoading(false);
      hideLoader();
    }
  };

  // Reverse filtered entries and apply pagination
  const paginatedEntries = filteredEntries?.slice().reverse().slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  const totalPages = Math.ceil((filteredEntries?.length || 0) / entriesPerPage);




  // Query to check if user can add entry
  const { data: canAddEntryData, refetch: refetchCanAddEntry } = useQuery({
    queryKey: ["/api/can-add-entry"],
    refetchOnWindowFocus: false
  }); const addEntryMutation = useMutation({
    mutationFn: async (data: { name: string; amount: number }) => {
      showLoader();

      try {
        const mk = accountingMonthKeyFromDate(new Date());
        if (interactionDisabled(mk)) {
          throw new Error(monthLockBlockTooltip(gateReason(mk)));
        }
        // First check if user can add entry
        await refetchCanAddEntry();

        if (canAddEntryData && !canAddEntryData.canAddEntry) {
          throw new Error(canAddEntryData.message);
        }

        const res = await apiRequest("POST", "/api/entries", data);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: () => {
      setDataLoading(true);
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      showSuccess("Entry added successfully");
      setOpenAddDialog(false); // Close the Add Entry dialog on success
      setNewEntry({ name: "", amount: "" }); // Optionally, clear the form
      hideLoader();
    },
    onError: (error: any) => {
      showError(error.message || "You've exceeded your fair share of contributions.");
      hideLoader();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEntry.name.trim();
    const amt = parseFloat(newEntry.amount);
    if (!trimmed || Number.isNaN(amt) || amt <= 0) return;
    addEntryMutation.mutate({ name: trimmed, amount: amt });
  };

  const addEntryCanSubmit =
    newEntry.name.trim().length > 0 &&
    !Number.isNaN(parseFloat(newEntry.amount)) &&
    parseFloat(newEntry.amount) > 0;

  const quickAmountPresets = useMemo(
    () => [25, 34, 50, 65, 80, 100, 150, 200, 250, 500, 750, 1000],
    []
  );

  /** Full list for desktop dialog. */
  const entryQuickCombos = useMemo(
    () =>
      [
        { label: "Milk · ₹25", name: "Milk Morning", amount: 25 },
        { label: "Milk eve · ₹25", name: "Milk Evening", amount: 25 },
        { label: "Milk · ₹34", name: "Milk Day", amount: 34 },
        { label: "Milk · ₹50", name: "Milk Morning", amount: 50 },
        { label: "Veg · ₹50", name: "Vegtable", amount: 50 },
        { label: "Veg · ₹80", name: "Vegtable", amount: 80 },
        { label: "Chai · ₹25", name: "Chaipatti", amount: 25 },
        { label: "Sugar · ₹34", name: "Sugar", amount: 34 },
        { label: "Masala · ₹34", name: "Masala", amount: 34 },
        { label: "Room · ₹100", name: "Room Product", amount: 100 },
        { label: "Sugar · ₹50", name: "Sugar", amount: 50 },
        { label: "Masala · ₹50", name: "Masala", amount: 50 },
      ] as const,
    []
  );

  /** Compact 8 presets for mobile sheet (fits one screen, no scroll). */
  const entryQuickCombosSheet = useMemo(
    () =>
      [
        { label: "Milk ₹25", name: "Milk Morning", amount: 25 },
        { label: "Milk eve ₹25", name: "Milk Evening", amount: 25 },
        { label: "Milk ₹34", name: "Milk Day", amount: 34 },
        { label: "Veg ₹50", name: "Vegtable", amount: 50 },
        { label: "Chai ₹25", name: "Chaipatti", amount: 25 },
        { label: "Sugar ₹34", name: "Sugar", amount: 34 },
        { label: "Masala ₹34", name: "Masala", amount: 34 },
        { label: "Room ₹100", name: "Room Product", amount: 100 },
      ] as const,
    []
  );

  /** Sheet: 8 amounts = 4×2, fits screen better. */
  const quickAmountPresetsSheet = useMemo(
    () => [25, 34, 50, 100, 250, 500, 1000, 1500],
    []
  );

  const isQuickComboActive = (c: { name: string; amount: number }) =>
    newEntry.name === c.name && newEntry.amount === String(c.amount);

  const onAddEntryOpenChange = (open: boolean) => {
    if (!open) {
      setOpenAddDialog(false);
      return;
    }
    if (!addEntryBlocked) setOpenAddDialog(true);
  };

  const options = [
    { value: "Milk Morning", label: "Milk Morning" },
    { value: "Milk Evening", label: "Milk Evening" },
    { value: "Milk Day", label: "Milk Day" },
    { value: "Vegtable", label: "Vegtable" },
    { value: "Chaipatti", label: "Chaipatti" },
    { value: "Room Product", label: "Room Product" },
    { value: "Sugar", label: "Sugar" },
    { value: "Masala", label: "Masala" },
  ];


  return (
    <TooltipProvider>
      <Header />
      <div className="min-h-screen bg-[#0f0f1f] px-2.5 pt-24 pb-28 md:p-8 md:pt-36 md:pb-28 md:pl-[272px]">
        <div className="max-w-7xl mx-auto">
          <div className="md:hidden mb-5 space-y-3">
            {monthStatus === "unavailable" && (
              <MonthLockUnavailableBanner className="max-w-xl" />
            )}
            {monthStatus === "loading" && (
              <MonthLockStatusSkeleton className="max-w-xl" />
            )}
            {monthStatus === "ready" && isLocked(currentCalendarMonthKey) && (
              <MonthLockedBanner className="max-w-xl" />
            )}
            <div className="relative overflow-hidden rounded-2xl border border-[#7c3fbf]/30 bg-gradient-to-br from-[#16161f] via-[#0f0f18] to-[#13131c] px-4 py-4 shadow-lg shadow-black/45">
              <div
                className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-[#7c3fbf]/25 blur-2xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-8 left-1/4 h-20 w-40 rounded-full bg-[#582c84]/20 blur-2xl"
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c49bff]/80">Flat expenses</p>
                  <h1 className="mt-1 bg-gradient-to-r from-white via-white to-[#d4b8ff] bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                    Entries
                  </h1>
                  <p className="mt-2 max-w-sm text-base leading-snug text-white/65">
                    Add rows below, swipe <span className="text-[#c49bff]">Your status</span> for your share.
                  </p>
                </div>
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#7c3fbf]/35 bg-[#582c84]/25 shadow-inner shadow-black/20"
                  aria-hidden
                >
                  <Receipt className="h-5 w-5 text-[#c49bff]" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[#7c3fbf]/25 bg-[#13131c] p-3 space-y-2.5 shadow-lg shadow-black/40">
              <div className="flex flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={
                        addEntryBlocked
                          ? `inline-block ${monthLockWaitCursor(monthStatus === "loading")}`
                          : "inline-block"
                      }
                    >
                      <Button
                        disabled={addEntryBlocked}
                        onClick={() => !addEntryBlocked && setOpenAddDialog(true)}
                        aria-label={
                          addEntryBlocked
                            ? monthLockActionAria("Add entry", gateReason(currentCalendarMonthKey))
                            : "Add entry"
                        }
                        className="flex items-center gap-2 bg-[#582c84] text-white shadow-md shadow-black/30 hover:bg-[#542d87] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <LuUserPlus className="h-5 w-5 shrink-0" aria-hidden />
                        Add entry
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {addEntryBlocked && (
                    <TooltipContent className="max-w-xs bg-[#1c1b2d] border border-white/10 text-white text-xs">
                      {monthLockBlockTooltip(gateReason(currentCalendarMonthKey))}
                    </TooltipContent>
                  )}
                </Tooltip>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContributionSheetOpen(true)}
                  className={cn(
                    "flex items-center gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10 shadow-md shadow-black/25",
                    hasCurrentUserContributionWarning && "border-amber-500/50 bg-amber-500/10"
                  )}
                  aria-haspopup="dialog"
                  aria-expanded={contributionSheetOpen}
                >
                  <PanelRight className="h-4 w-4 shrink-0 text-[#c49bff]" aria-hidden />
                  Your status
                </Button>
              </div>
              {isAdmin && (
                <div className="pt-2 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white/10 border-white/20 text-white text-sm shadow-md shadow-black/25 hover:bg-white/15"
                    onClick={handleRunContributionCheck}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 shrink-0 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Run contribution
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Sheet open={contributionSheetOpen} onOpenChange={setContributionSheetOpen}>
            <SheetContent
              side="right"
              className={cn(
                "flex flex-col gap-0 overflow-hidden p-0",
                "left-0 h-[100dvh] max-h-[100dvh] w-full !max-w-none rounded-none border-0 bg-[#0f0f1f] sm:!max-w-none",
                "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
                "[&>button]:right-4 [&>button]:top-[max(1rem,env(safe-area-inset-top))] [&>button]:text-white/80 [&>button:hover]:bg-white/10 [&>button:hover]:text-white"
              )}
            >
              <div
                className="h-1 shrink-0 bg-gradient-to-r from-[#582c84] via-[#7c3fbf] to-[#c49bff]"
                aria-hidden
              />
              <SheetHeader className="shrink-0 space-y-1 border-b border-white/10 bg-[#13131c] px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] pr-14 text-left shadow-sm shadow-black/20">
                <SheetTitle className="text-lg font-semibold tracking-tight text-white">
                  Contribution status
                </SheetTitle>
                <SheetDescription className="text-xs text-white/50">Your share vs fair share.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {totals && users && user?._id ? (
                  <div className="mx-auto max-w-lg rounded-xl border border-[#7c3fbf]/25 bg-[#13131c] p-4 shadow-lg shadow-black/40 sm:max-w-xl">
                    <ContributionStatus
                      embedded
                      userContribution={totals.userTotal}
                      fairShare={totals.fairShareAmount}
                      userId={String(user._id)}
                      flatTotalEntry={totals.flatTotal}
                      totalUsers={users.length}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-[#13131c] px-4 py-10 text-center text-sm text-white/50 shadow-md shadow-black/30">
                    Loading contribution data…
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={openAddDialog && !isMdUp} onOpenChange={onAddEntryOpenChange}>
            <SheetContent
              side="right"
              className={cn(
                "flex flex-col gap-0 overflow-hidden p-0",
                "left-0 h-[100dvh] max-h-[100dvh] w-full !max-w-none rounded-none border-0 bg-[#0f0f1f] sm:!max-w-none",
                "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
                "[&>button]:right-4 [&>button]:top-[max(1rem,env(safe-area-inset-top))] [&>button]:text-white/80 [&>button:hover]:bg-white/10 [&>button:hover]:text-white"
              )}
            >
              <div
                className="h-1 shrink-0 bg-gradient-to-r from-[#582c84] via-[#7c3fbf] to-[#c49bff]"
                aria-hidden
              />
              <SheetHeader className="shrink-0 border-b border-white/10 bg-[#13131c] px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] pr-14 text-left">
                <SheetTitle className="text-base font-bold text-white">Add entry</SheetTitle>
                <SheetDescription className="text-[11px] leading-snug text-white/45">
                  One tap = item + ₹. Tags = name only. Then ₹ and Save.
                </SheetDescription>
              </SheetHeader>
              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-2">
                  <div className="shrink-0 space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-[#c49bff]">
                      One tap bill
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {entryQuickCombosSheet.map((c) => (
                        <button
                          key={`${c.name}-${c.amount}-${c.label}`}
                          type="button"
                          onClick={() => setNewEntry({ name: c.name, amount: String(c.amount) })}
                          className={cn(
                            "flex min-h-[40px] touch-manipulation items-center justify-center rounded-xl border-0 px-1 py-1 text-center text-[10px] font-bold leading-tight transition active:scale-[0.98]",
                            isQuickComboActive(c)
                              ? "bg-gradient-to-b from-[#8350b8] to-[#5a2d85] text-white shadow-[0_4px_0_0_rgba(0,0,0,0.35),0_8px_24px_rgba(124,63,191,0.45),0_0_0_1px_rgba(196,155,255,0.35)]"
                              : "bg-[#2d2d3d] text-white shadow-[0_4px_0_0_rgba(0,0,0,0.45),0_6px_16px_rgba(0,0,0,0.55),0_0_0_1px_rgba(124,63,191,0.14),inset_0_1px_0_rgba(255,255,255,0.07)] hover:brightness-110"
                          )}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0 space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-[#c49bff]">
                      Name tags
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewEntry((p) => ({ ...p, name: opt.value }))}
                          className={cn(
                            "min-h-[32px] touch-manipulation rounded-full border-0 px-2 py-1 text-[10px] font-medium transition active:scale-[0.98]",
                            newEntry.name === opt.value
                              ? "bg-gradient-to-b from-[#8350b8] to-[#5a2d85] text-white shadow-[0_3px_0_0_rgba(0,0,0,0.35),0_6px_18px_rgba(124,63,191,0.4),0_0_0_1px_rgba(196,155,255,0.35)]"
                              : "bg-[#2d2d3d] text-white/90 shadow-[0_3px_0_0_rgba(0,0,0,0.4),0_4px_12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(124,63,191,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] hover:brightness-110"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 shrink-0">
                    <Label htmlFor="entry-name-sheet" className="sr-only">
                      Item name
                    </Label>
                    <CreatableSelect
                      inputId="entry-name-sheet"
                      options={options}
                      isClearable
                      formatCreateLabel={(inputValue) => `Add “${inputValue}”`}
                      placeholder="Other item — search or type"
                      noOptionsMessage={() => "Type to add"}
                      value={newEntry.name ? { value: newEntry.name, label: newEntry.name } : null}
                      onChange={(selectedOption) => {
                        setNewEntry((prev) => ({
                          ...prev,
                          name: selectedOption ? selectedOption.value : "",
                        }));
                      }}
                      onCreateOption={(inputValue) => {
                        setNewEntry((prev) => ({ ...prev, name: inputValue.trim() }));
                      }}
                      className="w-full text-sm"
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      menuPosition="fixed"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: 38,
                          fontSize: 13,
                          borderRadius: 10,
                          backgroundColor: "#2d2d3d",
                          borderWidth: 0,
                          borderColor: "transparent",
                          boxShadow: state.isFocused
                            ? "0 0 0 2px rgba(196, 155, 255, 0.4), 0 8px 24px rgba(124, 63, 191, 0.25), 0 4px 16px rgba(0,0,0,0.5)"
                            : "0 3px 0 0 rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.55), 0 0 0 1px rgba(124, 63, 191, 0.15), inset 0 1px 0 rgba(255,255,255,0.07)",
                          "&:hover": {
                            boxShadow:
                              "0 4px 0 0 rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(124, 63, 191, 0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
                          },
                        }),
                        menu: (base) => ({
                          ...base,
                          borderRadius: 10,
                          backgroundColor: "#1a1a28",
                          border: "1px solid rgba(124, 63, 191, 0.35)",
                          zIndex: 250,
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 250 }),
                        option: (base, { isFocused, isSelected }) => ({
                          ...base,
                          backgroundColor: isSelected
                            ? "#582c84"
                            : isFocused
                              ? "rgba(124, 63, 191, 0.22)"
                              : "#1a1a28",
                          color: "white",
                          cursor: "pointer",
                          fontSize: 13,
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: "white",
                          fontSize: 13,
                        }),
                        input: (base) => ({ ...base, color: "white" }),
                        placeholder: (base) => ({ ...base, color: "rgba(255,255,255,0.38)" }),
                      }}
                    />
                  </div>

                  <div className="shrink-0 space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-[#c49bff]">
                      ₹ quick
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {quickAmountPresetsSheet.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNewEntry((prev) => ({ ...prev, amount: String(preset) }))}
                          className={cn(
                            "min-h-[38px] touch-manipulation rounded-xl border-0 py-1 text-center text-[11px] font-bold tabular-nums leading-none transition active:scale-[0.98]",
                            newEntry.amount === String(preset)
                              ? "bg-gradient-to-b from-[#8350b8] to-[#5a2d85] text-white shadow-[0_4px_0_0_rgba(0,0,0,0.35),0_8px_22px_rgba(124,63,191,0.42),0_0_0_1px_rgba(196,155,255,0.35)]"
                              : "bg-[#2d2d3d] text-white shadow-[0_4px_0_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(124,63,191,0.14),inset_0_1px_0_rgba(255,255,255,0.07)] hover:brightness-110"
                          )}
                        >
                          ₹{preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative mt-3 shrink-0 border-t border-white/[0.08] pt-3">
                    <Label htmlFor="entry-amount-sheet" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#c49bff]">
                      Amount
                    </Label>
                    <div className="relative">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-base font-bold text-[#c49bff]"
                        aria-hidden
                      >
                        ₹
                      </span>
                      <Input
                        id="entry-amount-sheet"
                        type="number"
                        inputMode="decimal"
                        enterKeyHint="done"
                        min={0}
                        step="any"
                        placeholder="0.00"
                        autoComplete="off"
                        name="entry-amount"
                        value={newEntry.amount}
                        onChange={(e) => setNewEntry((prev) => ({ ...prev, amount: e.target.value }))}
                        className="h-11 min-h-[44px] rounded-xl border-0 bg-[#2d2d3d] pl-10 pr-3 text-base font-semibold tabular-nums text-white shadow-[0_4px_0_0_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(124,63,191,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] placeholder:text-white/35 focus-visible:shadow-[0_0_0_2px_rgba(196,155,255,0.45),0_10px_28px_rgba(124,63,191,0.25)] focus-visible:outline-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {addEntryBlocked && (
                    <p className="shrink-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100/90">
                      Month locked.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2 border-t border-white/10 bg-[#13131c]/95 px-4 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 flex-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => setOpenAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!addEntryCanSubmit || addEntryMutation.isPending || addEntryBlocked}
                    className="h-10 flex-1 border-0 bg-gradient-to-r from-[#6d3a9e] to-[#7c3fbf] text-sm font-semibold text-white shadow-[0_4px_0_0_rgba(0,0,0,0.35),0_8px_28px_rgba(124,63,191,0.45)] disabled:opacity-40 active:scale-[0.98] active:shadow-[0_2px_0_0_rgba(0,0,0,0.35)]"
                  >
                    {addEntryMutation.isPending ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>

          <div className="hidden md:block mb-8">
          <div className="relative group">
            {/* Blurred border layer */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>

            {/* Main content */}
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10 flex flex-wrap justify-between items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c49bff]/75">Flat ledger</p>
                <h1 className="mt-0.5 bg-gradient-to-r from-white via-white to-[#dcc4ff] bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                  Entries
                </h1>
                <p className="mt-1 max-w-lg text-sm leading-snug text-white/55">
                  Table below — add, search, approve. Toggle status for your fair share.
                </p>
                {monthStatus === "unavailable" && (
                  <MonthLockUnavailableBanner className="mt-2 max-w-xl" />
                )}
                {monthStatus === "loading" && (
                  <MonthLockStatusSkeleton className="mt-2 max-w-xl" />
                )}
                {monthStatus === "ready" && isLocked(currentCalendarMonthKey) && (
                  <MonthLockedBanner className="mt-2 max-w-xl" />
                )}
              </div>

              <div className="flex gap-2 flex-wrap justify-end">
                {/* Contribution Check Button for Admins */}
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="bg-white/80 hover:bg-white/90 text-gray-700"
                    onClick={handleRunContributionCheck}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Run Contribution
                  </Button>
                )}

                <Dialog open={openAddDialog && isMdUp} onOpenChange={onAddEntryOpenChange}>
                  <div className="hidden md:block">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={
                          addEntryBlocked
                            ? `inline-block ${monthLockWaitCursor(monthStatus === "loading")}`
                            : "inline-block"
                        }
                      >
                        <DialogTrigger asChild>
                          <Button
                            disabled={addEntryBlocked}
                            aria-label={
                              addEntryBlocked
                                ? monthLockActionAria("Add entry", gateReason(currentCalendarMonthKey))
                                : "Add entry"
                            }
                            className="flex items-center gap-2 px-4 py-2 bg-[#582c84] text-white rounded-lg shadow-md transition hover:bg-[#542d87] disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <LuUserPlus className="h-5 w-5" aria-hidden />
                            <span>Add Entry</span>
                          </Button>
                        </DialogTrigger>
                      </span>
                    </TooltipTrigger>
                    {addEntryBlocked && (
                      <TooltipContent className="max-w-xs bg-[#1c1b2d] border border-white/10 text-white text-xs">
                        {monthLockBlockTooltip(gateReason(currentCalendarMonthKey))}
                      </TooltipContent>
                    )}
                  </Tooltip>
                  </div>

                  <DialogContent
                    className={cn(
                      "left-[50%] top-[50%] max-h-[min(90vh,640px)] w-[calc(100vw-1.25rem)] max-w-[400px] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden rounded-2xl border border-[#7c3fbf]/35 bg-[#0f0f1f] p-0 shadow-2xl shadow-black/60 sm:max-w-[420px]",
                      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    )}
                  >
                    <div
                      className="h-1.5 shrink-0 bg-gradient-to-r from-[#582c84] via-[#7c3fbf] to-[#c49bff]"
                      aria-hidden
                    />
                    <DialogHeader className="space-y-0 border-b border-white/10 bg-[#13131c]/90 px-5 pb-4 pt-4 text-left">
                      <div className="flex gap-3 pr-10">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#582c84] to-[#7c3fbf] shadow-lg shadow-[#582c84]/30">
                          <Receipt className="h-6 w-6 text-white" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <DialogTitle className="text-xl font-bold tracking-tight text-white">
                            Add entry
                          </DialogTitle>
                          <DialogDescription className="text-sm text-white/50">
                            Quick name, amount in ₹, save.
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
                      <div className="max-h-[min(52vh,400px)] space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:max-h-[min(56vh,440px)]">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#c49bff]/90">
                            One tap (name + ₹)
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            {entryQuickCombos.map((c) => (
                              <button
                                key={`dlg-${c.name}-${c.amount}-${c.label}`}
                                type="button"
                                onClick={() => setNewEntry({ name: c.name, amount: String(c.amount) })}
                                className={cn(
                                  "rounded-xl border-0 px-2.5 py-2.5 text-left text-xs font-bold shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition sm:text-sm",
                                  isQuickComboActive(c)
                                    ? "bg-gradient-to-b from-[#6b3a9a] to-[#582c84] text-white shadow-[0_6px_20px_rgba(88,44,132,0.5)] ring-2 ring-[#c49bff]/45"
                                    : "bg-[#1e1e2a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
                                )}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#c49bff]/90">
                            Item name
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {options.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setNewEntry((prev) => ({ ...prev, name: opt.value }))}
                                className={cn(
                                  "rounded-full border-0 px-3 py-2 text-xs font-medium shadow-[0_3px_12px_rgba(0,0,0,0.4)] transition-all duration-200",
                                  newEntry.name === opt.value
                                    ? "bg-gradient-to-b from-[#6b3a9a] to-[#582c84] text-white shadow-[0_5px_16px_rgba(88,44,132,0.45)] ring-2 ring-[#c49bff]/40"
                                    : "bg-[#222230] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_5px_14px_rgba(0,0,0,0.45)]"
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="entry-name-select" className="text-[11px] font-semibold uppercase tracking-wider text-[#c49bff]/90">
                            Or type / search
                          </Label>
                          <CreatableSelect
                            inputId="entry-name-select"
                            options={options}
                            isClearable
                            formatCreateLabel={(inputValue) => `Add “${inputValue}”`}
                            placeholder="Type to search or create…"
                            noOptionsMessage={() => "Type a new name and press Enter"}
                            value={newEntry.name ? { value: newEntry.name, label: newEntry.name } : null}
                            onChange={(selectedOption) => {
                              setNewEntry((prev) => ({
                                ...prev,
                                name: selectedOption ? selectedOption.value : "",
                              }));
                            }}
                            onCreateOption={(inputValue) => {
                              setNewEntry((prev) => ({ ...prev, name: inputValue.trim() }));
                            }}
                            className="w-full"
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            styles={{
                              control: (base, state) => ({
                                ...base,
                                minHeight: 48,
                                borderRadius: 12,
                                backgroundColor: "#1a1a24",
                                borderWidth: 0,
                                borderColor: "transparent",
                                boxShadow: state.isFocused
                                  ? "0 0 0 2px rgba(124, 63, 191, 0.45), 0 6px 20px rgba(0,0,0,0.45)"
                                  : "0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                                "&:hover": {
                                  boxShadow:
                                    "0 6px 18px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.06)",
                                },
                              }),
                              menu: (base) => ({
                                ...base,
                                borderRadius: 12,
                                backgroundColor: "#1a1a28",
                                border: "1px solid rgba(124, 63, 191, 0.35)",
                                overflow: "hidden",
                                zIndex: 100,
                              }),
                              menuPortal: (base) => ({ ...base, zIndex: 200 }),
                              option: (base, { isFocused, isSelected }) => ({
                                ...base,
                                backgroundColor: isSelected
                                  ? "#582c84"
                                  : isFocused
                                    ? "rgba(124, 63, 191, 0.25)"
                                    : "#1a1a28",
                                color: "white",
                                cursor: "pointer",
                                fontSize: "0.875rem",
                              }),
                              singleValue: (base) => ({
                                ...base,
                                color: "white",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "calc(100% - 20px)",
                              }),
                              input: (base) => ({
                                ...base,
                                color: "white",
                              }),
                              placeholder: (base) => ({
                                ...base,
                                color: "rgba(255,255,255,0.4)",
                              }),
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="entry-amount" className="text-[11px] font-semibold uppercase tracking-wider text-[#c49bff]/90">
                            Amount (₹) — tap or type
                          </Label>
                          <div className="grid grid-cols-4 gap-2">
                            {quickAmountPresets.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  setNewEntry((prev) => ({
                                    ...prev,
                                    amount: String(preset),
                                  }))
                                }
                                className={cn(
                                  "rounded-xl border-0 py-2 text-center text-xs font-semibold tabular-nums shadow-[0_4px_12px_rgba(0,0,0,0.42)] transition-all sm:text-sm",
                                  newEntry.amount === String(preset)
                                    ? "bg-gradient-to-b from-[#6b3a9a] to-[#582c84] text-white shadow-[0_6px_18px_rgba(88,44,132,0.5)] ring-2 ring-[#c49bff]/45"
                                    : "bg-[#1c1c28] text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.48)]"
                                )}
                              >
                                ₹{preset}
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 border-t border-white/10 pt-4">
                            <div className="relative">
                              <span
                                className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-xl font-bold text-[#c49bff]"
                                aria-hidden
                              >
                                ₹
                              </span>
                              <Input
                                id="entry-amount"
                                type="number"
                                inputMode="decimal"
                                enterKeyHint="done"
                                min={0}
                                step="any"
                                placeholder="0.00"
                                autoComplete="off"
                                value={newEntry.amount}
                                onChange={(e) => setNewEntry((prev) => ({ ...prev, amount: e.target.value }))}
                                className="h-14 min-h-[52px] rounded-xl border-0 bg-[#1a1a24] pl-12 pr-4 text-lg font-semibold tabular-nums text-white shadow-[0_6px_22px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-white/30 focus-visible:shadow-[0_0_0_2px_rgba(124,63,191,0.55),0_8px_24px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-0"
                              />
                            </div>
                          </div>
                        </div>

                        {addEntryBlocked && (
                          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                            This month is locked — entries cannot be added until an admin unlocks it.
                          </p>
                        )}
                      </div>

                      <DialogFooter className="gap-2 border-t border-white/10 bg-[#13131c]/80 px-5 py-4 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-white/70 hover:bg-white/10 hover:text-white"
                          onClick={() => setOpenAddDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={!addEntryCanSubmit || addEntryMutation.isPending || addEntryBlocked}
                          className="min-w-[140px] border-0 bg-gradient-to-r from-[#582c84] to-[#7c3fbf] font-semibold text-white shadow-[0_6px_20px_rgba(88,44,132,0.45),0_2px_8px_rgba(0,0,0,0.35)] hover:from-[#6a3599] hover:to-[#8b4fd4] disabled:opacity-40"
                        >
                          {addEntryMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                              Saving…
                            </>
                          ) : (
                            "Save entry"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
          </div>

          <div className="grid gap-6 grid-cols-1 mb-8">
            <Card
              className={cn(
                "text-white rounded-xl transition-shadow",
                "border border-[#7c3fbf]/25 bg-[#13131c] shadow-lg shadow-black/35",
                "md:border-white/10 md:bg-[#582c84] md:shadow-xl md:shadow-black/40 md:duration-300 md:hover:scale-[1.01]"
              )}
            >
              {/* Fair Share Information */}

              <div className="w-full overflow-x-auto px-4 py-4 bg-transparent rounded-t-lg" style={{
                scrollbarWidth: "none", // Hide scrollbar for Firefox
                msOverflowStyle: "none", // Hide scrollbar for IE/Edge
              }}>
                <div className="flex space-x-6 min-w-max ">
                  {entries && Array.isArray(entries) && entries.length > 0 ? (
                    (() => {
                      const totalApprovedGlobal = entries
                        .filter((e) => e.status === "APPROVED")
                        .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1; // Avoid division by zero

                      const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;

                      // Create a normalized array of unique user IDs
                      const normalizedUserIds = entries.map(e => {
                        const userId = typeof e.userId === 'object' && e.userId !== null
                          ? (e.userId._id || e.userId.id || e.userId)
                          : e.userId;
                        return userId?.toString();
                      });

                      // Filter out any undefined/null values and create a unique set
                      return Array.from(new Set(normalizedUserIds.filter(id => id))).map((userId) => {
                        const userEntries = entries.filter((e) => {
                          // Handle different userId formats
                          const entryUserId = typeof e.userId === 'object' && e.userId !== null
                            ? (e.userId._id || e.userId.id || e.userId)
                            : e.userId;

                          return entryUserId?.toString() === userId?.toString();
                        });
                        const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
                        const pendingEntries = userEntries.filter((e) => e.status === "PENDING");

                        // Get user penalty details
                        const userPenaltyCount = allUserPenalties[userId]?.entries || 0;
                        const userPenaltyAmount = allUserPenalties[userId]?.totalAmount || 0;



                        const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                        const totalPendingAmount = pendingEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                        const totalAmountAfterPenalty = totalApprovedAmount - userPenaltyAmount;


                        const userName = (typeof userEntries[0]?.userId === 'object' && userEntries[0]?.userId?.name) ||
                          users?.find(u => u._id === userId)?.name || "Unknown";
                        const userProfile =
                          (typeof userEntries[0]?.userId === 'object' && userEntries[0]?.userId?.profilePicture) ||
                          users?.find(u => u._id === userId)?.profilePicture;

                        const progressPercentage = Math.min((totalAmountAfterPenalty / totalGlobalAfterPenalty) * 100, 100).toFixed(0);


                        // ✅ Corrected Color Logic
                        const getBorderColor = () => {
                          if (progressPercentage >= 81) return "#00FF00"; // 🟢 Green (81-100%)
                          if (progressPercentage >= 51) return "#FFD700"; // 🟡 Yellow (51-80%)
                          return "#FF4500"; // 🔴 Red (0-50%)
                        };

                        // ✅ Calculate position for percentage text
                        const progressAngle = (progressPercentage / 100) * 360;
                        const radius = 28; // Radius for positioning text
                        const angleRad = (progressAngle - 90) * (Math.PI / 180);
                        const textX = Math.cos(angleRad) * radius;
                        const textY = Math.sin(angleRad) * radius;

                        return (
                          <div key={userId} className="flex items-center gap-x-4 border-white/10 pt-2 bg-white/5 rounded-md shadow-md px-4 py-3 relative">
                            {/* Profile Picture with Circular Progress Border */}
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                              {/* Circular Progress Border */}
                              <div
                                className="absolute inset-0 rounded-full flex items-center justify-center"
                                style={{
                                  background: `conic-gradient(${getBorderColor()} ${progressPercentage}%, rgba(255, 255, 255, 0.1) ${progressPercentage}%)`,
                                  padding: "3px",
                                  borderRadius: "50%",
                                }}
                              >                                <Avatar className="w-full h-full">
                                  <AvatarImage 
                                    src={userProfile}
                                    alt={`${userName} profile picture`}
                                    className="object-cover"
                                  />
                                  <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                                    {getInitials(userName)}
                                  </AvatarFallback>
                                </Avatar>
                              </div>

                              {/* ✅ Percentage Text at Progress End Point - Smaller Size & Better Padding */}
                              <div
                                className="absolute text-[10px] sm:text-xs font-semibold"
                                style={{
                                  transform: `translate(${textX}px, ${textY}px)`,
                                  left: "50%",
                                  top: "50%",
                                  whiteSpace: "nowrap",
                                  padding: "2px 4px",
                                  background: "rgba(0, 0, 0, 0.75)", // Darker background for visibility
                                  borderRadius: "4px",
                                  color: getBorderColor(), // ✅ Percentage text color according to progress
                                }}
                              >
                                {progressPercentage}%
                              </div>
                            </div>

                            {/* ✅ Premium Divider Line */}
                            <div className="w-[2px] h-12 bg-gradient-to-b from-indigo-400 via-purple-500 to-pink-500 shadow-md rounded-full"></div>

                            {/* ✅ User Info - Added Margin for Better Spacing */}
                            <div className="text-xs text-white/80 flex flex-col gap-y-1">
                              <div className="font-semibold text-sm">{userName}</div>
                              <div className="text-white/60">{approvedEntries.length} Approved Entries</div>
                              <div className={`font-bold ${totalAmountAfterPenalty < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                ₹{totalAmountAfterPenalty.toFixed(2)}
                              </div>

                              {/* <div className="text-white/60">{userPenaltyCount} Penalties</div> */}
                              {/* <div className="font-bold text-red-400">₹{userPenaltyAmount}</div> */}

                              <div className="text-white/60">{pendingEntries.length} Pending Entries</div>
                              <div className="font-bold text-yellow-400">₹{totalPendingAmount.toFixed(2)}</div>
                            </div>
                          </div>



                        );
                      });
                    })()
                  ) : (
                    <div className="w-full flex items-center justify-center py-8 sm:py-10 md:py-12 lg:py-16 px-2 sm:px-2 md:px-2 min-h-[240px] sm:min-h-[280px] md:min-h-[320px] lg:min-h-[360px]">
                      <div className="flex flex-col items-center justify-center max-w-2xl mx-auto">
                        {/* Icon container with responsive sizing and hover effects */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-[#582c84] to-[#8e4be4] rounded-full flex items-center justify-center mb-4 sm:mb-5 md:mb-6 lg:mb-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 md:animate-pulse">
                          <FaClipboardList className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white" />
                        </div>
                        
                        {/* Heading with responsive text sizes and improved spacing */}
                        <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-3 sm:mb-4 md:mb-5 lg:mb-6 text-center tracking-tight">
                          No Entries Yet
                        </h3>
                        
                        {/* Description with responsive text, width, and improved readability */}
                        <p className="text-white/70 text-sm sm:text-base md:text-lg lg:text-xl text-center max-w-[300px] sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl leading-relaxed px-2 sm:px-0 font-medium">
                          Start adding your expenses to track contributions and manage flat finances effectively
                        </p>
                        
                        {/* Tip with responsive spacing, text, and improved styling */}
                        <div className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 text-xs sm:text-sm md:text-base text-white/50 text-center max-w-[280px] sm:max-w-sm md:max-w-md lg:max-w-lg flex items-center gap-2 sm:gap-3 bg-white/5 rounded-full px-4 py-2 sm:px-5 sm:py-3 backdrop-blur-sm border border-white/10">
                          <span className="text-lg sm:text-xl">💡</span>
                          <span className="font-medium">Tip: Use the "Add Entry" button to get started</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-semibold">Overall Statistics</CardTitle>
                    {/* Desktop Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowContributionStatus(!showContributionStatus)}
                      className={`hidden sm:flex relative overflow-hidden transition-all duration-300 border-2 backdrop-blur-md ${
                        totals && users && entries && Array.isArray(entries) && entries.length > 0 && (() => {
                          // Only check current user's deficit, not all users  
                          const currentUserId = user?._id?.toString();
                          let hasCurrentUserWarning = false;
                          
                          if (currentUserId) {
                            const totalApprovedGlobal = entries
                              .filter((e) => e.status === "APPROVED")
                              .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
                            const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
                            const fairSharePerUser = totalGlobalAfterPenalty / (users?.length || 1);
                            
                            const userEntries = entries.filter((e) => {
                              const entryUserId = typeof e.userId === 'object' && e.userId !== null
                                ? (e.userId._id || e.userId.id || e.userId)
                                : e.userId;
                              return entryUserId?.toString() === currentUserId;
                            });
                            const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
                            const userPenaltyAmount = allUserPenalties[currentUserId]?.totalAmount || 0;
                            const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                            const totalAmountAfterPenalty = totalApprovedAmount - userPenaltyAmount;
                            
                            // Use the same logic as ContributionStatus component
                            const fairSharePercentage = 100 / (users?.length || 1);
                            const userContributionPercentage = totalGlobalAfterPenalty > 0 
                              ? (totalAmountAfterPenalty / totalGlobalAfterPenalty) * 100 
                              : 0;
                            const fairShareThreshold = (75 * fairSharePercentage) / 100;
                            
                            hasCurrentUserWarning = totalGlobalAfterPenalty > 0 && fairSharePerUser > 0 && totalAmountAfterPenalty > 0 && userContributionPercentage < fairShareThreshold;
                          }
                          
                          return hasCurrentUserWarning;
                        })()
                          ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 border-red-400/50 hover:border-red-400/70 shadow-red-500/20 animate-pulse'
                          : 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border-purple-400/50 hover:border-purple-400/70 text-black shadow-purple-500/20'
                      } shadow-lg hover:shadow-xl hover:scale-105`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex items-center gap-2">
                        {/* Dynamic Icon based on warning state */}
                        {totals && users && entries && Array.isArray(entries) && entries.length > 0 ? (() => {
                          const currentUserId = user?._id?.toString();
                          let hasCurrentUserWarning = false;
                          
                          if (currentUserId) {
                            const totalApprovedGlobal = entries
                              .filter((e) => e.status === "APPROVED")
                              .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
                            const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
                            const fairSharePerUser = totalGlobalAfterPenalty / (users?.length || 1);
                            
                            const userEntries = entries.filter((e) => {
                              const entryUserId = typeof e.userId === 'object' && e.userId !== null
                                ? (e.userId._id || e.userId.id || e.userId)
                                : e.userId;
                              return entryUserId?.toString() === currentUserId;
                            });
                            const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
                            const userPenaltyAmount = allUserPenalties[currentUserId]?.totalAmount || 0;
                            const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                            const totalAmountAfterPenalty = totalApprovedAmount - userPenaltyAmount;
                            
                            // Use the same logic as ContributionStatus component
                            const fairSharePercentage = 100 / (users?.length || 1);
                            const userContributionPercentage = totalGlobalAfterPenalty > 0 
                              ? (totalAmountAfterPenalty / totalGlobalAfterPenalty) * 100 
                              : 0;
                            const fairShareThreshold = (75 * fairSharePercentage) / 100;
                            
                            hasCurrentUserWarning = totalGlobalAfterPenalty > 0 && fairSharePerUser > 0 && totalAmountAfterPenalty > 0 && userContributionPercentage < fairShareThreshold;
                          }
                          
                          // Show red warning icon if user has warning, green success icon otherwise
                          if (hasCurrentUserWarning) {
                            return (
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-4 w-4 text-red-400" 
                                viewBox="0 0 20 20" 
                                fill="currentColor"
                              >
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            );
                          } else {
                            return (
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-4 w-4 text-[#9a4de7]" 
                                viewBox="0 0 20 20" 
                                fill="currentColor"
                              >
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            );
                          }
                        })() : (
                          // Neutral icon when no entries
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-4 w-4 text-gray-400 mt-1" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className={`font-semibold text-xs text-black ${
                          totals && users && entries && Array.isArray(entries) && entries.length > 0 && (() => {
                            // Only check current user's deficit, not all users  
                            const currentUserId = user?._id?.toString();
                            let hasCurrentUserWarning = false;
                            if (currentUserId) {
                              const totalApprovedGlobal = entries
                                .filter((e) => e.status === "APPROVED")
                                .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
                              const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
                              const fairSharePerUser = totalGlobalAfterPenalty / (users?.length || 1);
                              const userEntries = entries.filter((e) => {
                                const entryUserId = typeof e.userId === 'object' && e.userId !== null
                                  ? (e.userId._id || e.userId.id || e.userId)
                                  : e.userId;
                                return entryUserId?.toString() === currentUserId;
                              });
                              const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
                              const userPenaltyAmount = allUserPenalties[currentUserId]?.totalAmount || 0;
                              const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                              const totalAmountAfterPenalty = totalApprovedAmount - userPenaltyAmount;
                              // Use the same logic as ContributionStatus component
                              const fairSharePercentage = 100 / (users?.length || 1);
                              const userContributionPercentage = totalGlobalAfterPenalty > 0 
                                ? (totalAmountAfterPenalty / totalGlobalAfterPenalty) * 100 
                                : 0;
                              const fairShareThreshold = (75 * fairSharePercentage) / 100;
                              hasCurrentUserWarning = totalGlobalAfterPenalty > 0 && fairSharePerUser > 0 && totalAmountAfterPenalty > 0 && userContributionPercentage < fairShareThreshold;
                            }
                            return hasCurrentUserWarning ? 'animate-pulse' : '';
                          })() ? 'animate-pulse' : ''
                        }`}>
                          {showContributionStatus ? "Hide" : "Show"} Status
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Total Amount */}
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Total Amount:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-green-400 text-lg">
                      ₹
                      {entries && Array.isArray(entries) && entries.length > 0
                        ? (() => {
                          // Calculate the total approved amount
                          const totalApproved = entries
                            .filter((e: Entry) => e.status === "APPROVED")
                            .reduce((sum: number, entry: Entry) => sum + (entry.amount || 0), 0);

                          // Ensure penaltiesTotal is a valid number
                          const totalAfterPenalty = totalApproved - (totalPenaltyAmount || 0);

                          return totalAfterPenalty.toFixed(2);
                        })()
                        : "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries && Array.isArray(entries) ? entries.filter((e: Entry) => e.status === "APPROVED").length : 0} Entries
                    </div>
                  </div>
                </div>

                {/* Pending */}
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Pending:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹{entries && Array.isArray(entries) 
                          ? entries.filter((e: Entry) => e.status === "PENDING")
                              .reduce((sum: number, entry: Entry) => sum + (entry.amount || 0), 0).toFixed(2) 
                          : "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries && Array.isArray(entries) ? entries.filter((e: Entry) => e.status === "PENDING").length : 0} Entries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contribution status — desktop inline only; mobile uses sheet drawer */}
            {showContributionStatus && totals && users && (
              <div className="hidden md:block">
                <ContributionStatus
                  userContribution={totals.userTotal}
                  fairShare={totals.fairShareAmount}
                  userId={String(user._id)}
                  flatTotalEntry={totals.flatTotal}
                  totalUsers={users.length}
                />
              </div>
            )}
          </div>




          
            <div className="mb-4 flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-xl">
                <Input
                  type="text"
                  placeholder="Search by name, amount, date, status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#151525] border-[#582c84]/30 text-white placeholder:text-white/50 pl-10 py-6 rounded-xl shadow-md focus:ring-2 focus:ring-[#582c84] transition-all duration-200"
                />
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-lg" />
              </div>

              {/* Delete Selected Button */}
              <div className="flex justify-end">
                {selectedEntries.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={monthStatus !== "ready" || anySelectedIncludesLockedMonth}
                    className="flex items-center gap-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaTrash className="text-sm" />
                    Delete Selected ({selectedEntries.length})
                  </Button>
                )}
              </div>
            </div>
          

          <Table className="w-full overflow-x-auto bg-[#151525] rounded-xl shadow-lg shadow-black/30 border border-[#582c84]/20">
            <TableHeader>
              <TableRow className="border-none">

                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap min-w-[200px]">
                  <span className="block">User</span>
                </TableHead>
                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap min-w-[180px]">
                  <span className="block">Entry Name</span>
                </TableHead>
                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap">
                  <span className="block">Amount</span>
                </TableHead>
                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none min-w-[160px]">
                  <span className="block whitespace-nowrap">Date & Time</span>
                </TableHead>


                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 border-none">Status</TableHead>
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <>
                    <TableHead className="text-center text-indigo-200/80 font-semibold py-3 border-none">Actions</TableHead>
                    <TableHead className="w-10 text-center text-indigo-200/80 font-semibold py-3 border-[#582c84]">
                      <input
                        type="checkbox"
                        checked={
                          selectableFilteredEntries.length > 0 &&
                          selectableFilteredEntries.every((entry) => selectedEntries.includes(entry._id))
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        aria-label="Select all entries on this page"
                        className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150"
                      />


                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>


            <TableBody>
              {paginatedEntries?.map((entry) => {
                const entryMonthKey = entryAccountingMonthKey(entry);
                const entryActionsLocked = interactionDisabled(entryMonthKey);
                const entryRowLooksLocked = rowLooksLocked(entryMonthKey);
                return (
                <TableRow
                  key={entry._id}
                  className={cn(
                    "transition duration-200 hover:bg-[#1f1f2e] hover:shadow-inner border-none",
                    lockedRowClassName(entryRowLooksLocked)
                  )}
                >
                  <TableCell className="min-w-[200px] py-4 px-3">
                    <div className="flex items-center gap-3 p-2 rounded-lg border border-[#582c84]/30 bg-[#1c1b2d] shadow-sm">
                      {entryRowLooksLocked && (
                        <MonthLockIcon decorative className="shrink-0 text-[13px]" />
                      )}
                      <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#582c84]/50">
                        <AvatarImage
                          src={
                            typeof entry.userId === 'object' && entry.userId?.profilePicture
                              ? entry.userId.profilePicture
                              : users?.find(u => u._id === (typeof entry.userId === 'string' ? entry.userId : ''))?.profilePicture ||
                              entry.user?.profilePicture
                          }
                          alt="User"
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                          {getInitials(
                            typeof entry.userId === 'object' && entry.userId?.name
                              ? entry.userId.name
                              : users?.find(u => u._id === (typeof entry.userId === 'string' ? entry.userId : ''))?.name ||
                              entry.user?.name || "Unknown User"
                          )}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="truncate max-w-[140px] sm:max-w-[180px]">
                        <span className="font-medium text-white">{typeof entry.userId === 'object' && entry.userId?.name
                          ? entry.userId.name
                          : users?.find(u => u._id === (typeof entry.userId === 'string' ? entry.userId : ''))?.name ||
                          entry.user?.name || "Unknown User"}
                        </span>
                      </div>
                    </div>

                  </TableCell>

                  <TableCell className="font-medium text-white min-w-[180px] py-4 px-3">
                    <div className="flex sm:justify-start justify-center items-center gap-2 group/tooltip relative">
                      <Tooltip supportMobileTap={true}>
                        <TooltipTrigger asChild>
                          <div className="max-w-[120px] sm:max-w-[180px] cursor-pointer flex items-center gap-1 hover:text-[#9f5bf7] transition-colors relative">
                            <span className="inline-block overflow-hidden text-ellipsis whitespace-nowrap">{entry.name}</span>
                            {entry.name.length > 15 && <span className="opacity-60"></span>}
                            <BsThreeDots className="w-4 h-4 opacity-0 group-hover/tooltip:opacity-100 transition-opacity text-[#9f5bf7]" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="center"
                          sideOffset={5}
                          className="bg-[#1f1f2e] border border-[#582c84] px-3 py-2 max-w-[200px] sm:max-w-[300px] break-words shadow-lg animate-in fade-in-0 zoom-in-95 sm:hidden"
                        >
                          <p className="text-sm text-white whitespace-normal">{entry.name}</p>
                        </TooltipContent>
                        <TooltipContent
                          side="right"
                          align="start"
                          className="bg-[#1f1f2e] border border-[#582c84] px-3 py-2 max-w-[200px] sm:max-w-[300px] break-words shadow-lg animate-in fade-in-0 zoom-in-95 hidden sm:block"
                        >
                          <p className="text-sm text-white whitespace-normal">{entry.name}</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Touch hint text */}
                      <span className="text-xs text-[#9f5bf7]/60 sm:hidden absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap">
                        Tap to view full name
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="font-semibold text-[#9f5bf7] py-4 px-3">
                    ₹{entry.amount.toFixed(2)}
                  </TableCell>

                  <TableCell className="min-w-[160px] text-gray-400 py-4 px-3">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.dateTime))}
                  </TableCell>

                  <TableCell className="py-4 px-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium
              ${entry.status === "APPROVED" ? "bg-white/10 text-[#ab6bff]" :
                          entry.status === "PENDING" ? "bg-yellow-200/10 text-yellow-300" :
                            "bg-red-200/10 text-red-400"}`}
                    >
                      {entry.status}
                    </span>
                  </TableCell>

                  {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                    <TableCell className="text-center py-4 px-3">
                      {entry.status === "PENDING" ? (
                        <div className="flex justify-center sm:justify-start gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={entryActionsLocked ? "inline-block cursor-not-allowed" : "inline-block"}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={entryActionsLocked}
                                  aria-label={
                                    entryActionsLocked
                                      ? monthLockActionAria("Approve entry", gateReason(entryMonthKey))
                                      : "Approve entry"
                                  }
                                  className="text-white bg-[#582c84] border-[#582c84] hover:bg-[#8e4be4] hover:text-white disabled:opacity-40"
                                  onClick={() => approveRejectMutation.mutate({ entryId: entry._id, status: "APPROVED" })}
                                >
                                  Approve
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {entryActionsLocked && (
                              <TooltipContent className="max-w-xs bg-[#1c1b2d] border border-white/10 text-white text-xs">
                                {MONTH_LOCKED_MESSAGE}
                              </TooltipContent>
                            )}
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={entryActionsLocked ? "inline-block cursor-not-allowed" : "inline-block"}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={entryActionsLocked}
                                  aria-label={
                                    entryActionsLocked
                                      ? monthLockActionAria("Decline entry", gateReason(entryMonthKey))
                                      : "Decline entry"
                                  }
                                  className="bg-red text-red-400 border-red-500 hover:bg-red-600/10 hover:text-red-500 disabled:opacity-40"
                                  onClick={() => approveRejectMutation.mutate({ entryId: entry._id, status: "REJECTED" })}
                                >
                                  Decline
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {entryActionsLocked && (
                              <TooltipContent className="max-w-xs bg-[#1c1b2d] border border-white/10 text-white text-xs">
                                {MONTH_LOCKED_MESSAGE}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </div>
                      ) : (
                        <EditEntryDialog entry={entry} ledgerLocked={entryActionsLocked} />
                      )}
                    </TableCell>
                  )}

                  {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                    <TableCell className="text-center py-4 px-3">
                      <input
                        type="checkbox"
                        disabled={entryActionsLocked}
                        title={entryActionsLocked ? monthLockBlockTooltip(gateReason(entryMonthKey)) : undefined}
                        aria-label={
                          entryActionsLocked
                            ? monthLockActionAria("Select entry for bulk delete", gateReason(entryMonthKey))
                            : "Select entry for bulk delete"
                        }
                        checked={selectedEntries.includes(entry._id)}
                        onChange={(e) => handleSelectEntry(entry._id, e.target.checked)}
                        className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                      />

                    </TableCell>
                  )}
                </TableRow>
              );
              })}
            </TableBody>
          </Table>


          {/* No Entries Found Message */}
          {(!entries || entries.length === 0) ? (
            <div className="py-8 text-center text-white/60">
              <div className="flex flex-col items-center justify-center space-y-3">
                <FaClipboardList className="w-12 h-12 text-[#582c84] opacity-50" />
                <p className="text-lg font-medium">No entries found</p>
                <p className="text-sm text-white/40">Start by adding your first entry!</p>
              </div>
            </div>
          ) : filteredEntries && filteredEntries.length > 0 ? (
            /* Pagination Component - Only shown when filtered entries exist */
            <div className="flex justify-center mt-4">
              <CustomPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : (
            <div className="py-8 text-center text-white/60">
              <div className="flex flex-col items-center justify-center space-y-3">
                <FaClipboardList className="w-12 h-12 text-[#582c84] opacity-50" />
                <p className="text-lg font-medium">No matching entries found</p>
                <p className="text-sm text-white/40">Try adjusting your search criteria</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Multiple Entries"
        description={`Are you sure you want to delete ${selectedEntries.length} selected entries?\nThis action cannot be undone and all selected entries will be permanently removed.`}
        onConfirm={confirmBulkDelete}
        confirmText="Delete Selected"
        cancelText="Cancel"
      />

      {/* Mobile Navigation */}
      <div className="block md:hidden">
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
