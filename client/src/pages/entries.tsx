import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LuUserPlus } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContributionStatus } from "@/components/contribution-status";
import { LuMoreHorizontal } from "react-icons/lu";
import { BsThreeDots } from "react-icons/bs";

const getInitials = (name: string | undefined) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

// Create a separate component for editing an entry.
function EditEntryDialog({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const handleDelete = () => {
    showLoader(); // Show loader before deleting
    fetch(`/api/entries/${entry._id}`, {
      method: "DELETE",
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
        showSuccess(`Entry "${entry.name}" has been deleted successfully.`);
        hideLoader(); // Hide loader after successful deletion
      })
      .catch((error) => {
        console.error(error);
        showError(`Failed to delete entry: ${error.message}`);
        hideLoader(); // Hide loader on error
      });
  };

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
          </DialogHeader>          <form onSubmit={(e) => {
            e.preventDefault();
            showLoader(); // Show loader before updating the entry
            const formData = new FormData(e.currentTarget);
            fetch(`/api/entries/${entry._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: formData.get("name"),
                amount: parseFloat(formData.get("amount") as string),
              }),
            })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
                showSuccess(`Entry "${entry.name}" has been updated successfully.`);
                setOpen(false); // Close the dialog on success
                hideLoader(); // Hide loader after successful update
              })
              .catch((error) => {
                console.error(error);
                showError(`Failed to update entry: ${error.message}`);
                hideLoader(); // Hide loader on error
              });
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
  const [newEntry, setNewEntry] = useState({ name: "", amount: "" });
  const [openAddDialog, setOpenAddDialog] = useState(false); // State for controlling the Add Entry dialog
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 6; // Limit of 10 per page
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showContributionStatus, setShowContributionStatus] = useState(false);

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
      // Only select IDs from filtered entries
      const filteredIds = filteredEntries.map((entry: Entry) => entry._id);
      setSelectedEntries(filteredIds);
    } else {
      setSelectedEntries([]);
    }
  };

  // Function to handle selecting/deselecting a single entry
  const handleSelectEntry = (entryId: string, checked: boolean) => {
    if (checked) {
      // Only allow selection if the entry is in the filtered entries
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
  }; const confirmBulkDelete = () => {
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
    addEntryMutation.mutate({
      name: newEntry.name,
      amount: parseFloat(newEntry.amount),
    });
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
      <div className="min-h-screen p-8 pt-36 pb-28 bg-[#0f0f1f]">
        <div className="max-w-7xl mx-auto">
          <div className="relative group mb-8">
            {/* Blurred border layer */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>

            {/* Main content */}
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10 flex flex-wrap justify-between items-center gap-4">
              <h1 className="text-2xl sm:text-3xl text-white font-bold">Entries</h1>

              <div className="flex gap-2">
                {/* Contribution Check Button for Admins */}
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <Button
                    variant="outline"
                    className="bg-white/80 hover:bg-white/90 text-gray-700"
                    onClick={async () => {
                      showLoader();
                      setDataLoading(true);

                      try {
                        const res = await fetch('/api/check-contribution-penalties', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ skipAdmins: false }),
                        });

                        const data = await res.json();

                        if (data.deficitUsers?.length > 0) {
                          showWarning(data.message);
                        } else {
                          showSuccess(data.message);
                        }

                        // Refresh data
                        queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/entries/total"] });
                      } catch (error) {
                        showError("Failed to run contribution check");
                      } finally {
                        setDataLoading(false); // ensure loading state is cleared
                        hideLoader(); // stop the loader regardless of success/failure
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Run Contribution
                  </Button>
                )}

                <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
                  <DialogTrigger asChild>
                    <Button
                      className="flex items-center gap-2 px-4 py-2 bg-[#582c84] text-white rounded-lg shadow-md transition hover:bg-[#542d87]"
                    >
                      <LuUserPlus className="h-5 w-5" />
                      <span>Add Entry</span>
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="top-[40vh] max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-white">Add New Entry</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <CreatableSelect
                        options={options}
                        isClearable
                        placeholder="Select or type entry name"
                        value={newEntry.name ? { value: newEntry.name, label: newEntry.name } : null}
                        onChange={(selectedOption) => {
                          setNewEntry({ ...newEntry, name: selectedOption ? selectedOption.value : "" });
                        }}
                        onCreateOption={(inputValue) => {
                          setNewEntry({ ...newEntry, name: inputValue });
                        }}
                        className="w-full"
                        styles={{
                          control: (base) => ({
                            ...base,
                            backgroundColor: '#151525',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            '&:hover': {
                              borderColor: '#582c84'
                            }
                          }),
                          menu: (base) => ({
                            ...base,
                            backgroundColor: '#151525',
                            border: '1px solid rgba(102, 54, 163, 0.3)'
                          }),
                          option: (base, { isFocused, isSelected }) => ({
                            ...base,
                            backgroundColor: isSelected ? '#582c84' : isFocused ? 'rgba(102, 54, 163, 0.3)' : '#151525',
                            color: 'white',
                            cursor: 'pointer'
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: 'white',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 'calc(100% - 20px)'
                          }),
                          input: (base) => ({
                            ...base,
                            color: 'white',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          })
                        }}
                      />

                      <Input
                        type="number"
                        placeholder="Amount"
                        value={newEntry.amount}
                        onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                        className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                      />

                      <Button
                        type="submit"
                        disabled={addEntryMutation.isPending}
                        className="w-full bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg"
                      >
                        Add Entry
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 mb-8">
            <Card className="bg-[#582c84] duration-300 group-hover:scale-105 text-white shadow-xl border border-white/10 rounded-lg">
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
                        <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-[#582c84] to-[#8e4be4] rounded-full flex items-center justify-center mb-4 sm:mb-5 md:mb-6 lg:mb-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-pulse">
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
                  
                  {/* Mobile Button */}
                  <Button
                    variant="outline"
                    onClick={() => setShowContributionStatus(!showContributionStatus)}
                    className={`sm:hidden w-full relative overflow-hidden transition-all duration-300 border-2 backdrop-blur-md rounded-2xl py-4 px-6 ${
                      totals && users && entries && Array.isArray(entries) && entries.length > 0 && (() => {
                        const totalApprovedGlobal = entries
                          .filter((e) => e.status === "APPROVED")
                          .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
                        const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
                        const normalizedUserIds = entries.map(e => {
                          const userId = typeof e.userId === 'object' && e.userId !== null
                            ? (e.userId._id || e.userId.id || e.userId)
                            : e.userId;
                          return userId?.toString();
                        });
                        const hasWarnings = Array.from(new Set(normalizedUserIds.filter(id => id))).some((userId) => {
                          const userEntries = entries.filter((e) => {
                            const entryUserId = typeof e.userId === 'object' && e.userId !== null
                              ? (e.userId._id || e.userId.id || e.userId)
                              : e.userId;
                            return entryUserId?.toString() === userId?.toString();
                          });
                          const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
                          const userPenaltyAmount = allUserPenalties[userId]?.totalAmount || 0;
                          const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                          const totalAmountAfterPenalty = totalApprovedAmount - userPenaltyAmount;
                          const progressPercentage = Math.min((totalAmountAfterPenalty / totalGlobalAfterPenalty) * 100, 100);
                          return progressPercentage < 51;
                        });
                      })()
                        ? 'bg-gradient-to-r from-red-500/20 via-orange-500/15 to-red-500/20 hover:from-red-500/30 hover:via-orange-500/25 hover:to-red-500/30 border-red-400/50 hover:border-red-400/70 shadow-red-500/30 animate-pulse'
                        : 'bg-gradient-to-r from-purple-500/20 via-blue-500/15 to-purple-500/20 hover:from-purple-500/30 hover:via-blue-500/25 hover:to-purple-500/30 border-purple-400/50 hover:border-purple-400/70 text-black shadow-purple-500/30'
                    } shadow-xl hover:shadow-2xl hover:scale-[1.02] transform`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-white/10 opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative flex items-center justify-center gap-3">
                      {totals && users && entries && Array.isArray(entries) && entries.length > 0 && (() => {
                        const totalApprovedGlobal = entries
                          .filter((e) => e.status === "APPROVED")
                          .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
                        const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
                        const normalizedUserIds = entries.map(e => {
                          const userId = typeof e.userId === 'object' && e.userId !== null
                            ? (e.userId._id || e.userId.id || e.userId)
                            : e.userId;
                          return userId?.toString();
                        });
                        // Only check current user's deficit, not all users
                        const currentUserId = user?._id?.toString();
                        let hasCurrentUserWarning = false;
                        
                        if (currentUserId) {
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
                          
                          hasCurrentUserWarning = totalGlobalAfterPenalty > 0 && (totalGlobalAfterPenalty / (users?.length || 1)) > 0 && totalAmountAfterPenalty > 0 && userContributionPercentage < fairShareThreshold;
                        }
                        
                        return hasCurrentUserWarning && (
                          <div className="relative">
                            <div className="w-3 h-3 bg-red-400 rounded-full animate-ping absolute"></div>
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          </div>
                        );
                      })()}
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-6 w-6 transition-transform duration-500 ${showContributionStatus ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <div className="flex flex-col items-center">
                        <span className={`font-bold text-sm leading-tight text-black ${
                          totals && users && entries && Array.isArray(entries) && entries.length > 0 && (() => {
                            // Only check current user's deficit, not all users
                            const currentUserId = user?._id?.toString();
                            let hasCurrentUserWarning = false;
                            
                            if (currentUserId) {
                              const totalApprovedGlobal = entries
                                .filter((e) => e.status === "APPROVED")
                                .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
                              const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
                              
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
                              
                              hasCurrentUserWarning = totalGlobalAfterPenalty > 0 && (totalGlobalAfterPenalty / (users?.length || 1)) > 0 && totalAmountAfterPenalty > 0 && userContributionPercentage < fairShareThreshold;
                            }
                            
                            return hasCurrentUserWarning;
                          })() ? 'animate-pulse' : ''
                        }`}>
                          {showContributionStatus ? "Hide" : "Show"} Contribution Status
                        </span>
                        {totals && users && entries && Array.isArray(entries) && entries.length > 0 && (() => {
                          // Only check current user's deficit, not all users
                          const currentUserId = user?._id?.toString();
                          let hasCurrentUserWarning = false;
                          
                          if (currentUserId) {
                            const totalApprovedGlobal = entries
                              .filter((e) => e.status === "APPROVED")
                              .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1;
                            const totalGlobalAfterPenalty = totalApprovedGlobal - totalPenaltyAmount;
                            
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
                            
                            hasCurrentUserWarning = totalGlobalAfterPenalty > 0 && (totalGlobalAfterPenalty / (users?.length || 1)) > 0 && totalAmountAfterPenalty > 0 && userContributionPercentage < fairShareThreshold;
                          }
                          
                          return hasCurrentUserWarning && (
                            <span className="text-xs opacity-80 font-medium">
                              Your contribution needs attention
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </Button>
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

            {/* Contribution Status Card */}
            {showContributionStatus && totals && users && (
              <ContributionStatus
                userContribution={totals.userTotal}
                fairShare={totals.fairShareAmount}
                userId={user._id}
                flatTotalEntry={totals.flatTotal}
                totalUsers={users.length}
              />
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
                    className="flex items-center gap-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaTrash className="text-sm" />
                    Delete Selected ({selectedEntries.length})
                  </Button>
                )}
              </div>
            </div>
          

          <Table className="w-full overflow-x-auto bg-[#151525] rounded-xl">
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
                        checked={filteredEntries?.length > 0 && selectedEntries.length === filteredEntries?.length && selectedEntries.every(id => filteredEntries.some(entry => entry._id === id))}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150"
                      />


                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>


            <TableBody>
              {paginatedEntries?.map((entry) => (
                <TableRow
                  key={entry._id}
                  className="transition duration-200 hover:bg-[#1f1f2e] hover:shadow-inner border-none"
                >
                  <TableCell className="min-w-[200px] py-4 px-3">
                    <div className="flex items-center gap-3 p-2 rounded-lg border border-[#582c84]/30 bg-[#1c1b2d] shadow-sm">                      <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#582c84]/50">
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-white bg-[#582c84] border-[#582c84] hover:bg-[#8e4be4] hover:text-white" onClick={() => {
                              showLoader(); // Show loader before approving
                              fetch(`/api/entries/${entry._id}/approved`, { method: "POST" })
                                .then(() => {
                                  toast({
                                    title: "Entry Approved",
                                    description: `Entry "${entry.name}" has been approved successfully.`,
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
                                  hideLoader(); // Hide loader after success
                                })
                                .catch((error) => {
                                  console.error(error);
                                  hideLoader(); // Hide loader on error
                                });
                            }}
                          >
                            Approve
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-red text-red-400 border-red-500 hover:bg-red-600/10 hover:text-red-500" onClick={() => {
                              showLoader(); // Show loader before rejecting
                              fetch(`/api/entries/${entry._id}/rejected`, { method: "POST" })
                                .then(() => {
                                  toast({
                                    title: "Entry Rejected",
                                    description: `Entry "${entry.name}" has been rejected.`,
                                    variant: "destructive",
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
                                  hideLoader(); // Hide loader after success
                                })
                                .catch((error) => {
                                  console.error(error);
                                  hideLoader(); // Hide loader on error
                                });
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      ) : (
                        <EditEntryDialog entry={entry} />
                      )}
                    </TableCell>
                  )}

                  {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                    <TableCell className="text-center py-4 px-3">
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(entry._id)}
                        onChange={(e) => handleSelectEntry(entry._id, e.target.checked)}
                        className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150"
                      />

                    </TableCell>
                  )}
                </TableRow>
              ))}
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
