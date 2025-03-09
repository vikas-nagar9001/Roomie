import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LuUserPlus } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { Link } from "wouter";
import favicon from "../../favroomie.png";
import { Input } from "@/components/ui/input";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Entry } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import CreatableSelect from "react-select/creatable";
import { FaUserCircle, FaEdit, FaTrash } from "react-icons/fa";
import { MdOutlineDateRange, MdAccessTime } from "react-icons/md";
import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/classic.css"; // Default theme
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
      <Dialog open={open} onOpenChange={setOpen} >

        <DialogTrigger asChild>
          {/* ✏️ Edit Button with Icon */}
          <button
            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition"
            onClick={() => setOpen(true)}
          >
            <FaEdit className="text-lg" />
          </button>
        </DialogTrigger>
        {/* 🗑️ Delete Button with Icon */}
        <button
          className="p-2 text-red-600 hover:bg-blue-100 rounded-full transition"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <FaTrash className="text-lg" />
        </button>

        <DialogContent className="top-40 max-w-80 w-full p-6 rounded-lg shadow-lg bg-indigo-100 border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Edit Entry</DialogTitle>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
            />
            <Input
              name="amount"
              type="number"
              defaultValue={entry.amount}
              placeholder="Amount"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
            />

            <Button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
            >
              <span> Update Entry</span>
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Entry"
        description={`Are you sure you want to delete entry "${entry.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
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

  const { data: totals } = useQuery<{ userTotal: number; flatTotal: number }>({
    queryKey: ["/api/entries/total"],
  });
  
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




  const addEntryMutation = useMutation({
    mutationFn: async (data: { name: string; amount: number }) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      toast({ title: "Entry added successfully" });
      setOpenAddDialog(false); // Close the Add Entry dialog on success
      setNewEntry({ name: "", amount: "" }); // Optionally, clear the form
    },
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
    <>

      {/* Header Section */}
      <div className="bg-gradient-to-r from-slate-900 via-[#241e95] to-indigo-800 p-6 shadow-lg flex justify-between items-center">
        {/* Logo and Profile Button (Logo on the left, Profile Button on the right) */}
        <div className="flex items-center gap-4 w-full">
          {/* Roomie Logo */}
          <Link to="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src={favicon} alt="Roomie Logo" className="h-12" />
              <h1 className="text-3xl font-bold text-white">Roomie</h1>
            </div>
          </Link>

          {/* Profile Button (aligned to the right on desktop) */}
          <div className="ml-auto">
            <Link href="/profile">
              <Button className="flex items-center gap-2 px-5 py-2 bg-white text-indigo-600 font-semibold rounded-lg shadow-md hover:bg-indigo-50 transition-all">
                <FiUser className="h-5 w-5 text-indigo-600" />
                {user?.name ? user.name.split(" ")[0] : "Profile"}
              </Button>
            </Link>
          </div>
        </div>
      </div>




      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-lg bg-gradient-to-r from-slate-900 via-[#241e95] to-indigo-100 p-5 flex flex-wrap justify-between items-center gap-4 mb-8">
            <h1 className="text-2xl sm:text-3xl text-white font-bold">Entries</h1>


            <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>

              <DialogTrigger asChild>
                <Button
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                >
                  <LuUserPlus className="h-5 w-5" />
                  <span>Add Entry</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="top-40 max-w-80 w-full p-6 rounded-lg shadow-lg bg-indigo-100 border border-gray-200">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-gray-800">Add New Entry</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Dropdown with Custom Input */}
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
                    className="w-full bg-indigo-500"
                  />

                  <Input
                    type="number"
                    placeholder="Amount"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none transition"
                  />

                  <Button
                    type="submit"
                    disabled={addEntryMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                  >
                    <span>Add Entry</span>
                  </Button>

                </form>
              </DialogContent>


            </Dialog>


          </div>

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 mb-8">


            <Card className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-xl border border-white/10 rounded-lg">
              <div className="w-full overflow-x-auto px-4 py-4 bg-transparent rounded-t-lg">
                <div className="flex space-x-6 min-w-max ">
                  {entries && Array.isArray(entries) && entries.length > 0 ? (
                    (() => {
                      const totalApprovedGlobal = entries
                        .filter((e) => e.status === "APPROVED")
                        .reduce((sum, entry) => sum + (entry.amount || 0), 0) || 1; // Avoid division by zero

                      return Array.from(new Set(entries.map((e) => 
                        typeof e.userId === 'object' ? e.userId._id : e.userId
                      ))).map((userId) => {
                        const userEntries = entries.filter((e) => 
                          (typeof e.userId === 'object' ? e.userId._id : e.userId) === userId
                        );
                        const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
                        const pendingEntries = userEntries.filter((e) => e.status === "PENDING");

                        const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                        const totalPendingAmount = pendingEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

                        const userName = (typeof userEntries[0]?.userId === 'object' && userEntries[0]?.userId?.name) || 
                          users?.find(u => u._id === userId)?.name || "Unknown";
                        const userProfile =
                          (typeof userEntries[0]?.userId === 'object' && userEntries[0]?.userId?.profilePicture) ||
                          users?.find(u => u._id === userId)?.profilePicture ||
                          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s";

                        const progressPercentage = Math.min((totalApprovedAmount / totalApprovedGlobal) * 100, 100).toFixed(0);

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
                              <div className="font-bold text-green-400">₹{totalApprovedAmount.toFixed(2)}</div>
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
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Total Amount:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-green-400 text-lg">
                      ₹
                      {entries && Array.isArray(entries) && entries.length > 0
                        ? entries
                          .filter((e) => e.status === "APPROVED")
                          .reduce((sum, entry) => sum + (entry.amount || 0), 0)
                          .toFixed(2)
                        : "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries && Array.isArray(entries) && entries.length > 0
                        ? entries.filter((e) => e.status === "APPROVED").length
                        : 0}{" "}
                      Entries
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Pending:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹
                      {entries && Array.isArray(entries) && entries.length > 0
                        ? entries
                          .filter((e) => e.status === "PENDING")
                          .reduce((sum, entry) => sum + (entry.amount || 0), 0)
                          .toFixed(2)
                        : "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries && Array.isArray(entries) && entries.length > 0
                        ? entries.filter((e) => e.status === "PENDING").length
                        : 0}{" "}
                      Entries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>





            <Card className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-xl border border-white/10 rounded-lg p-4">
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
                  <div className="flex items-center space-x-1 text-white/80">
                    <MdOutlineDateRange className="text-lg text-blue-400" />
                    <span className="font-medium">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-white/70">
                    <MdAccessTime className="text-lg text-green-400" />
                    <span className="font-medium">{new Date().toLocaleTimeString()}</span>
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
                      ₹{entries?.filter((e) => e.userId.toString() === user?._id.toString() && e.status === "APPROVED")
                        .reduce((sum, entry) => sum + entry.amount, 0).toFixed(2) || 0}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries?.filter((e) => e.userId.toString() === user?._id.toString() && e.status === "APPROVED").length || 0} Entries
                    </div>
                  </div>
                </div>

                {/* Pending */}
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Pending:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹{entries?.filter((e) => e.userId.toString() === user?._id.toString() && e.status === "PENDING")
                        .reduce((sum, entry) => sum + entry.amount, 0).toFixed(2) || 0}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries?.filter((e) => e.userId.toString() === user?._id.toString() && e.status === "PENDING").length || 0} Entries
                    </div>
                  </div>
                </div>

                {/* Top Expense Category with Top 5 Approved Entries List */}
                {entries && entries.length > 0 && (() => {
                  const approvedEntries = entries.filter(
                    (e) => {
                      const entryUserId = typeof e.userId === 'object' ? e.userId._id : e.userId;
                      return entryUserId === user?._id && e.status === "APPROVED";
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


          </div>



          {selectedEntries.length > 0 && (
            <div className="mb-4 flex justify-end">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                className="flex items-center gap-2"
              >
                <FaTrash className="text-sm" />
                Delete Selected ({selectedEntries.length})
              </Button>
            </div>
          )}
          
          <Table className="w-full overflow-x-auto bg-indigo-100">
            <TableHeader>
              <TableRow className="bg-slate-300">
                <TableHead className="text-left text-gray-800 font-bold">User</TableHead>
                <TableHead className="text-left text-gray-800 font-bold">Entry Name</TableHead>
                <TableHead className="text-left text-gray-800 font-bold">Amount</TableHead>
                <TableHead className="text-left text-gray-800 font-bold">Date & Time</TableHead>
                <TableHead className="text-left text-gray-800 font-bold">Status</TableHead>
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <TableHead className="text-center text-gray-800 font-bold">Actions</TableHead>
                )}
                <TableHead className="w-10 text-center text-gray-800 font-bold">
                  <input 
                    type="checkbox" 
                    checked={entries?.length > 0 && selectedEntries.length === entries?.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEntries?.map((entry) => (
                <TableRow key={entry._id} className="border-b hover:bg-gray-50">
                  <TableCell className="min-w-[200px]">
                    <div className="flex items-center gap-3">
                      <img
                        src={typeof entry.userId === 'object' && entry.userId?.profilePicture ? entry.userId.profilePicture : 
                          users?.find(u => u._id === (typeof entry.userId === 'string' ? entry.userId : ''))?.profilePicture || 
                          entry.user?.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"}
                        alt={typeof entry.userId === 'object' && entry.userId?.name ? entry.userId.name : 
                          users?.find(u => u._id === (typeof entry.userId === 'string' ? entry.userId : ''))?.name || 
                          entry.user?.name || "User"}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-gray-200"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                        }}
                      />
                      <div className="truncate max-w-[140px] sm:max-w-[180px]">
                        <span className="font-medium text-gray-800">
                          {typeof entry.userId === 'object' && entry.userId?.name ? entry.userId.name : 
                          users?.find(u => u._id === (typeof entry.userId === 'string' ? entry.userId : ''))?.name || 
                          entry.user?.name || "Unknown User"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium min-w-[180px] truncate">
                    {entry.name}
                  </TableCell>
                  <TableCell className="font-semibold text-blue-600"> ₹{entry.amount.toFixed(2)}</TableCell>
                  <TableCell className="min-w-[160px] text-gray-600">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.dateTime))}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${entry.status === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : entry.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                        }`}
                    >
                      {entry.status}
                    </span>
                  </TableCell>
                  {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                    <TableCell className="min-w-[180px] text-center">
                      {entry.status === "PENDING" ? (
                        <div className="flex justify-center sm:justify-start gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-600 hover:bg-green-100"
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
                            className="text-red-600 border-red-600 hover:bg-red-100"
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
                  <TableCell className="w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedEntries.includes(entry._id)}
                      onChange={(e) => handleSelectEntry(entry._id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Component */}
          <div className="flex justify-center mt-4">
            <ResponsivePagination
              current={currentPage}
              total={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>

        </div>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Multiple Entries"
        description={`Are you sure you want to delete ${selectedEntries.length} selected entries? This action cannot be undone.`}
        onConfirm={confirmBulkDelete}
        confirmText="Delete All"
        cancelText="Cancel"
      />
    </>
  );
}
