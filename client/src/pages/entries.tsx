import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LuUserPlus } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { Link } from "wouter";
import favicon from "../../favroomie.png";

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
import { Input } from "@/components/ui/input";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Entry } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import CreatableSelect from "react-select/creatable";
import { FaUserCircle } from "react-icons/fa";
import { MdOutlineDateRange, MdAccessTime } from "react-icons/md";


// Create a separate component for editing an entry.
function EditEntryDialog({ entry }: { entry: Entry }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen} >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="border-gray-300 text-gray-700 bg-slate-300 hover:bg-gray-100 transition-all"
        >
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm w-full p-6 rounded-xl shadow-lg bg-indigo-100 border border-gray-300">
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

  );
}

export default function EntriesPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [newEntry, setNewEntry] = useState({ name: "", amount: "" });
  const [openAddDialog, setOpenAddDialog] = useState(false); // State for controlling the Add Entry dialog

  const { data: entries } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
  });

  const { data: totals } = useQuery<{ userTotal: number; flatTotal: number }>({
    queryKey: ["/api/entries/total"],
  });

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
          <div className="flex items-center gap-3">
            <img src={favicon} alt="Roomie Logo" className="h-12" /> {/* Adjust the path accordingly */}
            <h1 className="text-3xl font-bold text-white">Roomie</h1>
          </div>

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
              <DialogContent className="max-w-sm w-full p-6 rounded-xl shadow-lg bg-indigo-100 border border-gray-200">
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
                    className="w-full"
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
              <div className="w-full overflow-x-auto px-4 py-2 bg-transferent rounded-t-lg">
                <div className="flex space-x-6 min-w-max">
                  {entries && Array.isArray(entries) && entries.length > 0 ? (
                    Array.from(new Set(entries.map((e) => e.userId))).map((userId) => {
                      const userEntries = entries.filter((e) => e.userId === userId);
                      const approvedEntries = userEntries.filter((e) => e.status === "APPROVED");
                      const pendingEntries = userEntries.filter((e) => e.status === "PENDING");

                      const totalApprovedAmount = approvedEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
                      const totalPendingAmount = pendingEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

                      const userName = userEntries[0]?.user?.name || "Unknown";
                      const userProfile =
                        userEntries[0]?.user?.profilePicture ||
                        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s";

                      return (
                        <div key={userId} className="flex items-center space-x-2 bg-white/10 px-3 py-2 rounded-lg shadow">
                          <img
                            src={userProfile}
                            alt={`${userName} profile picture`}
                            loading="lazy"
                            className="w-8 h-8 rounded-full border border-white object-cover bg-gray-200"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                            }}
                          />
                          <div className="text-xs text-white/80">
                            <div className="font-semibold">{userName}</div>
                            {/* Approved Entries */}
                            <div className="text-white/60">{approvedEntries.length} Approved Entries</div>
                            <div className="font-bold text-green-400">₹{totalApprovedAmount.toFixed(2)}</div>
                            {/* Pending Entries */}
                            <div className="text-white/60">{pendingEntries.length} Pending Entries</div>
                            <div className="font-bold text-yellow-400">₹{totalPendingAmount.toFixed(2)}</div>
                          </div>
                        </div>
                      );
                    })
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
                      ₹{entries && Array.isArray(entries) && entries.length > 0
                        ? entries.filter((e) => e.status === "APPROVED").reduce((sum, entry) => sum + (entry.amount || 0), 0).toFixed(2)
                        : "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries && Array.isArray(entries) && entries.length > 0
                        ? entries.filter((e) => e.status === "APPROVED").length
                        : 0} Entries
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Pending:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹{entries && Array.isArray(entries) && entries.length > 0
                        ? entries.filter((e) => e.status === "PENDING").reduce((sum, entry) => sum + (entry.amount || 0), 0).toFixed(2)
                        : "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {entries && Array.isArray(entries) && entries.length > 0
                        ? entries.filter((e) => e.status === "PENDING").length
                        : 0} Entries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>



            <Card className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-xl border border-white/10 rounded-lg p-4">
              {/* Header with Profile & Date-Time */}
              <div className="flex justify-between items-center border-b border-white/10 pb-3 flex-wrap">
                {/* Left Side: User Profile */}
                <div className="flex items-center space-x-3">
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt="User Profile"
                      className="w-12 h-12 rounded-full border border-white/20"
                    />
                  ) : (
                    <FaUserCircle className="text-5xl text-white/50" />
                  )}
                  <div>
                    <div className="text-sm font-semibold">{user?.name || "Guest User"}</div>
                    <div className="text-xs text-white/60 truncate w-32">{user?.email || "No Email"}</div>
                  </div>
                </div>

                {/* Right Side: Date & Time */}
                <div className="text-right text-sm mt-2 sm:mt-0">
                  <div className="flex items-center space-x-1 text-white/80">
                    <MdOutlineDateRange className="text-lg" />
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-white/70">
                    <MdAccessTime className="text-lg" />
                    <span>{new Date().toLocaleTimeString()}</span>
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
                {entries && entries.length > 0 && (
                  (() => {
                    const approvedEntries = entries.filter(
                      (e) => e.userId.toString() === user?._id.toString() && e.status === "APPROVED"
                    );

                    if (approvedEntries.length === 0) {
                      return <div className="text-white text-sm">No Approved Expenses Found</div>;
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
                      <div className="flex items-start border-t border-white/10 pt-3">
                        {/* Left Side: Scrollable Entries List */}
                        <div className="w-1/3 max-h-28 overflow-y-auto pr-3 border-r border-white/10">
                          <div className="text-yellow-300 text-xs font-medium mb-1">Top Entries</div>
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

                        {/* Right Side: Top Expense Details */}
                        <div className="w-2/3 pl-3 text-white text-sm space-y-2">
                          <div className="font-semibold">Top Expense Category:</div>
                          <div className="text-lg font-bold text-blue-400">{topCategory}</div>
                          <div className="text-sm text-white/70">
                            <span className="font-medium">Total Amount:</span> ₹{totalAmount.toFixed(2)}
                          </div>
                          <div className="text-sm text-white/70">
                            <span className="font-medium">Total Entries:</span> {topEntries.length}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>


          </div>



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
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries?.slice().reverse().map((entry) => (
                <TableRow key={entry._id} className="border-b hover:bg-gray-50">
                  {/* User Column */}
                  <TableCell className="min-w-[200px]">
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.user?.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"}
                        alt={entry.user?.name || "User"}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-gray-200"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                        }}
                      />
                      <div className="truncate max-w-[140px] sm:max-w-[180px]">
                        <span className="font-medium text-gray-800">
                          {entry.user?.name || "Unknown User"}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Entry Name */}
                  <TableCell className="font-medium min-w-[180px] truncate">
                    {entry.name}
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="font-semibold text-blue-600"> ₹{entry.amount.toFixed(2)}</TableCell>

                  {/* Date & Time */}
                  <TableCell className="min-w-[160px] text-gray-600">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.dateTime))}
                  </TableCell>

                  {/* Status */}
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

                  {/* Actions (Visible for Admins) */}
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
                                  queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
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
                                  queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
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
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </div>
      </div>
    </>
  );
}
