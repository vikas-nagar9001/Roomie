import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LuUserPlus } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { Link } from "wouter";
import favicon from "../../favroomie.png";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Entry } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import CreatableSelect from "react-select/creatable";
import { FaUserCircle, FaEdit, FaTrash, FaClipboardList } from "react-icons/fa";
import { MdOutlineDateRange, MdAccessTime } from "react-icons/md";
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


// Create a separate component for editing an entry.
function EditEntryDialog({ entry }: { entry: Entry }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    fetch(`/api/entries/${entry._id}`, {
      method: "DELETE",
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
        toast({
          title: "Entry Deleted",
          description: `Entry "${entry.name}" has been deleted successfully.`,
          variant: "destructive",
        });
      })
      .catch(console.error);
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
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
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
                  toast({
                    title: "Entry Updated",
                    description: `Entry "${entry.name}" has been updated successfully.`,
                  });
                  setOpen(false); // Close the dialog on success
                })
                .catch(console.error);
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
  const { toast } = useToast();
  const [newEntry, setNewEntry] = useState({ name: "", amount: "" });
  const [openAddDialog, setOpenAddDialog] = useState(false); // State for controlling the Add Entry dialog
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 6; // Limit of 10 per page
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  const { data: entries } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
  });

  const { data: totals } = useQuery<{ userTotal: number; flatTotal: number; fairSharePercentage: number; fairShareAmount: number; userContributionPercentage: number; isDeficit: boolean }>({
    queryKey: ["/api/entries/total"],
  });



  /////////////penalty data///////////////
  // all user penalty total  
  const [allUserPenalties, setPenalties] = useState<{ [userId: string]: { totalAmount: number; entries: number } }>({});
  const [totalPenaltyAmount, setTotalAmount] = useState(0);
  const [totalPenaltyEntries, setTotalEntries] = useState(0);

  useEffect(() => {
    const fetchPenalties = async () => {
      try {
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

      } catch (error) {
        console.error("Error fetching penalties:", error);
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
    if (checked && entries) {
      setSelectedEntries(entries.map(entry => entry._id));
    } else {
      setSelectedEntries([]);
    }
  };

  // Function to handle selecting/deselecting a single entry
  const handleSelectEntry = (entryId: string, checked: boolean) => {
    if (checked) {
      setSelectedEntries(prev => [...prev, entryId]);
    } else {
      setSelectedEntries(prev => prev.filter(id => id !== entryId));
    }
  };

  // Function to handle bulk deletion
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = () => {
    if (selectedEntries.length === 0) return;

    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    fetch('/api/entries/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds: selectedEntries }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
        toast({
          title: "Entries Deleted",
          description: `${selectedEntries.length} entries have been deleted successfully.`,
          variant: "destructive",
        });
        setSelectedEntries([]);
        setBulkDeleteDialogOpen(false);
      })
      .catch(error => {
        console.error("Failed to delete entries:", error);
        toast({
          title: "Error",
          description: "Failed to delete entries. Please try again.",
          variant: "destructive",
        });
        setBulkDeleteDialogOpen(false);
      });
  };


  // Reverse entries and apply pagination
  const paginatedEntries = entries?.slice().reverse().slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  const totalPages = Math.ceil((entries?.length || 0) / entriesPerPage);




  // Query to check if user can add entry
  const { data: canAddEntryData, refetch: refetchCanAddEntry } = useQuery({
    queryKey: ["/api/can-add-entry"],
    refetchOnWindowFocus: false
  });

  const addEntryMutation = useMutation({
    mutationFn: async (data: { name: string; amount: number }) => {
      // First check if user can add entry
      await refetchCanAddEntry();

      if (canAddEntryData && !canAddEntryData.canAddEntry) {
        throw new Error(canAddEntryData.message);
      }

      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/total"] });
      toast({ title: "Entry added successfully" });
      setOpenAddDialog(false); // Close the Add Entry dialog on success
      setNewEntry({ name: "", amount: "" }); // Optionally, clear the form
    },
    onError: (error: any) => {
      toast({
        title: "Cannot add entry",
        description: error.message || "You've exceeded your fair share of contributions.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEntryMutation.mutate({
      name: newEntry.name,
      amount: parseFloat(newEntry.amount),
    });
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

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
      <div className="min-h-screen p-8 pt-28 bg-[#0f0f1f]">
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
                      try {
                        const res = await fetch('/api/check-contribution-penalties', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ skipAdmins: false })
                        });

                        const data = await res.json();

                        toast({
                          title: "Contribution Check Complete",
                          description: data.message,
                          variant: data.deficitUsers?.length > 0 ? "destructive" : "default"
                        });

                        queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to run contribution check",
                          variant: "destructive"
                        });
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

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 mb-8">
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
                          users?.find(u => u._id === userId)?.profilePicture ||
                          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s";

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
                              >
                                {/* Profile Image */}
                                <img
                                  src={userProfile}
                                  alt={`${userName} profile picture`}
                                  loading="lazy"
                                  className="w-full h-full rounded-full border border-white object-cover bg-gray-200"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.onerror = null;
                                    target.src =
                                      "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                                  }}
                                />
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
                    <div className="text-white/60 text-sm">No entries found</div>
                  )}
                </div>
              </div>

              <CardHeader>
                <CardTitle className="text-lg font-semibold">Overall Statistics</CardTitle>
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
                            .filter((e) => e.status === "APPROVED")
                            .reduce((sum, entry) => sum + (entry.amount || 0), 0);

                          // Ensure penaltiesTotal is a valid number
                          const totalAfterPenalty = totalApproved - (totalPenaltyAmount || 0);

                          return totalAfterPenalty.toFixed(2);
                        })()
                        : "0.00"}

                    </div>
                    <div className="text-sm text-white/60">
                      {entries?.filter((e) => {
                        // Handle different userId formats
                        const entryUserId = typeof e.userId === 'object' && e.userId !== null
                          ? (e.userId._id || e.userId.id || e.userId)
                          : e.userId;

                        const userIdStr = entryUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();

                        return userIdStr === currentUserIdStr && e.status === "APPROVED";
                      }).length || 0} Entries
                    </div>
                  </div>
                </div>

                {/* Penalty */}
                {/* <div className="flex justify-between items-center">
                  <span className="text-white/80">Penalty:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹{totalPenaltyAmount}
                    </div>
                    <div className="text-sm text-white/60">
                      {totalPenaltyEntries} Entries
                    </div>
                  </div>
                </div> */}

                {/* Pending */}
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Pending:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹{entries?.filter((e) => {
                        // Handle different userId formats
                        const entryUserId = typeof e.userId === 'object' && e.userId !== null
                          ? (e.userId._id || e.userId.id || e.userId)
                          : e.userId;

                        const userIdStr = entryUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();


                        return userIdStr === currentUserIdStr && e.status === "PENDING";
                      })
                        .reduce((sum, entry) => sum + entry.amount, 0).toFixed(2) || "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries?.filter((e) => {
                        // Handle different userId formats
                        const entryUserId = typeof e.userId === 'object' && e.userId !== null
                          ? (e.userId._id || e.userId.id || e.userId)
                          : e.userId;

                        const userIdStr = entryUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();

                        return userIdStr === currentUserIdStr && e.status === "PENDING";
                      }).length || 0} Entries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>


            <Card className="bg-[#582c84] duration-300 group-hover:scale-105 text-white shadow-xl border border-white/10 rounded-lg p-4">
              {/* Header with Profile & Date-Time */}
              <div className="flex justify-between items-center border-b border-white/10 pb-3 flex-wrap gap-3 sm:gap-0">

                {/* Left Side: User Profile */}
                <div className="flex items-center space-x-3">
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt="User Profile"
                      className="w-12 h-12 rounded-full border border-white/20 shadow-lg transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <FaUserCircle className="text-5xl text-white/50 transition-transform duration-300 hover:scale-110" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-white">{user?.name || "Guest User"}</div>
                    <div className="text-xs text-white/60 truncate w-40 sm:w-32">{user?.email || "No Email"}</div>
                  </div>
                </div>

                {/* Right Side: Date & Time */}
                <div className="text-right text-sm mt-2 sm:mt-0">
                  {/* Date */}
                  <div className="flex items-center space-x-1 text-white/80">
                    <MdOutlineDateRange className="text-lg text-blue-400" />
                    <span className="font-medium">{currentTime.toLocaleDateString()}</span>
                  </div>

                  {/* Time (Live) */}
                  <div className="flex items-center space-x-1 text-white/70">
                    <MdAccessTime className="text-lg text-green-400" />
                    <span className="font-medium">{currentTime.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>


              {/* Card Content */}
              <CardContent className="space-y-4 mt-3">
                {/* Total Amount */}
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Total Amount:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-green-400 text-lg">
                      ₹
                      {(() => {
                        // Extract userId safely
                        const currentUserId = user?._id?.toString();

                        if (!currentUserId) return "0.00";

                        // Filter approved entries for the user
                        const userEntries = entries?.filter((e) => {
                          const entryUserId =
                            typeof e.userId === "object" && e.userId !== null
                              ? e.userId._id || e.userId.id || e.userId
                              : e.userId;

                          return entryUserId?.toString() === currentUserId && e.status === "APPROVED";
                        }) || [];

                        // Get the total penalty amount for the user
                        const userPenaltyAmount = allUserPenalties?.[currentUserId]?.totalAmount ?? 0;

                        // Sum up approved entries and subtract penalty
                        const totalAmount = userEntries.reduce((sum, entry) => sum + entry.amount, 0) - userPenaltyAmount;

                        return totalAmount.toFixed(2);
                      })()}
                    </div>


                    <div className="text-sm text-white/60">
                      {entries?.filter((e) => {
                        // Handle different userId formats
                        const entryUserId = typeof e.userId === 'object' && e.userId !== null
                          ? (e.userId._id || e.userId.id || e.userId)
                          : e.userId;

                        const userIdStr = entryUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();

                        return userIdStr === currentUserIdStr && e.status === "APPROVED";
                      }).length || 0} Entries
                    </div>
                  </div>
                </div>



                {/* Penalty */}
                {/* <div className="flex justify-between items-center">
                  <span className="text-white/80">Penalty:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹
                      {(() => {
                        const userId = user?._id?.toString(); // Ensure it's a string
                        if (!userId) return "0.00"; // Handle case where userId is undefined

                        const userPenalty = allUserPenalties?.[userId] || { totalAmount: 0, entries: 0 };
                        return userPenalty.totalAmount.toFixed(2);
                      })()}
                    </div>

                    <div className="text-sm text-white/60">
                      {(() => {
                        const userPenalty = allUserPenalties?.[user?._id] || { totalAmount: 0, entries: 0 };
                        return userPenalty.entries;
                      })()}{" "}
                      Entries
                    </div>
                  </div>
                </div> */}

                {/* Pending */}
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Pending:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹{entries?.filter((e) => {
                        // Handle different userId formats
                        const entryUserId = typeof e.userId === 'object' && e.userId !== null
                          ? (e.userId._id || e.userId.id || e.userId)
                          : e.userId;

                        const userIdStr = entryUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();


                        return userIdStr === currentUserIdStr && e.status === "PENDING";
                      })
                        .reduce((sum, entry) => sum + entry.amount, 0).toFixed(2) || "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries?.filter((e) => {
                        // Handle different userId formats
                        const entryUserId = typeof e.userId === 'object' && e.userId !== null
                          ? (e.userId._id || e.userId.id || e.userId)
                          : e.userId;

                        const userIdStr = entryUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();

                        return userIdStr === currentUserIdStr && e.status === "PENDING";
                      }).length || 0} Entries
                    </div>
                  </div>
                </div>

                {/* Top Expense Category with Top 5 Approved Entries List */}
                {entries && entries.length > 0 && (() => {
                  const approvedEntries = entries.filter(
                    (e) => {
                      // Handle different userId formats
                      const entryUserId = typeof e.userId === 'object' && e.userId !== null
                        ? (e.userId._id || e.userId.id || e.userId)
                        : e.userId;

                      const userIdStr = entryUserId?.toString();
                      const currentUserIdStr = user?._id?.toString();

                      return userIdStr === currentUserIdStr && e.status === "APPROVED";
                    }
                  );

                  if (approvedEntries.length === 0) {
                    return <div className="text-white text-sm text-center py-2">No Approved Expenses Found</div>;
                  }

                  const sortedEntries = [...approvedEntries].sort((a, b) => b.amount - a.amount);
                  const topEntries = sortedEntries.slice(0, 5);
                  const topCategory =
                    topEntries[0]?.category?.trim() ||
                    topEntries[0]?.entryCategory?.trim() ||
                    topEntries[0]?.name?.trim() ||
                    "No Category";
                  const totalAmount = topEntries.reduce((sum, entry) => sum + entry.amount, 0);

                  return (
                    <div className="border-t p-4 border-white/10 pt-2 bg-white/5 rounded-md shadow-md">

                      {/* Main Flex Container - Desktop & Mobile Same */}
                      <div className="flex items-start">

                        {/* Left Side: Entries List (Heading Fixed, Entries Scrollable) */}
                        <div className="w-1/3 pr-2 border-r border-white/10">
                          {/* Fixed Heading */}
                          <div className="text-cyan-300 text-sm font-medium mb-1 border-b border-white/10 pb-1">
                            Top Entries:
                          </div>

                          {/* Scrollable Entries List */}
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {topEntries.length > 0 ? (
                              topEntries.map((entry, index) => (
                                <div key={index} className="text-yellow-200 text-xs truncate">
                                  {index + 1}. {entry.entryName || entry.title || entry.name}
                                </div>
                              ))
                            ) : (
                              <div className="text-yellow-500 text-xs">No Entries Found</div>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Top Expense Details */}
                        <div className="w-2/3 pl-2 text-white text-sm space-y-1">
                          <div className="font-semibold">Top Expense Category:</div>
                          <div className="text-sm font-bold text-blue-400">{topCategory}</div>
                          <div className="text-xs text-white/70">
                            <span className="font-medium">Total Amount:</span> ₹{totalAmount.toFixed(2)}
                          </div>
                          <div className="text-xs text-white/70">
                            <span className="font-medium">Total Entries:</span> {topEntries.length}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })()}

              </CardContent>
            </Card>

            {/* Contribution Status Card */}
            {totals && users && (
              <ContributionStatus
                userContribution={totals.userTotal}
                fairShare={totals.fairShareAmount}
                userId={user._id}
                flatTotalEntry={totals.flatTotal}
                totalUsers={users.length}
              />
            )}
          </div>




          {selectedEntries.length > 0 && (
            <div className="mb-4 flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTrash className="text-sm" />
                Delete Selected ({selectedEntries.length})
              </Button>
            </div>
          )}

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
                        checked={entries?.length > 0 && selectedEntries.length === entries?.length}
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
                    <div className="flex items-center gap-3 p-2 rounded-lg border border-[#582c84]/30 bg-[#1c1b2d] shadow-sm">
                      <img
                        src={
                          typeof entry.userId === 'object' && entry.userId?.profilePicture
                            ? entry.userId.profilePicture
                            : users?.find(u => u._id === (typeof entry.userId === 'string' ? entry.userId : ''))?.profilePicture ||
                            entry.user?.profilePicture ||
                            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"
                        }
                        alt="User"
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-[#582c84]/50 bg-gray-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                        }}
                      />
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
                            className="text-white bg-[#582c84] border-[#582c84] hover:bg-[#8e4be4] hover:text-white"
                            onClick={() => {
                              fetch(`/api/entries/${entry._id}/approved`, { method: "POST" })
                                .then(() => {
                                  toast({
                                    title: "Entry Approved",
                                    description: `Entry "${entry.name}" has been approved successfully.`,
                                  });
                                })
                                .catch(console.error);
                            }}
                          >
                            Approve
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-red text-red-400 border-red-500 hover:bg-red-600/10 hover:text-red-500"
                            onClick={() => {
                              fetch(`/api/entries/${entry._id}/rejected`, { method: "POST" })
                                .then(() => {
                                  toast({
                                    title: "Entry Rejected",
                                    description: `Entry "${entry.name}" has been rejected.`,
                                    variant: "destructive",
                                  });
                                })
                                .catch(console.error);
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
          ) : (
            /* Pagination Component - Only shown when entries exist */
            <div className="flex justify-center mt-4">
              <CustomPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
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
