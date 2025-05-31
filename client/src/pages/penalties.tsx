import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FaUserCircle, FaEdit, FaTrash } from "react-icons/fa";
import { FiUser, FiList, FiCreditCard, FiAlertTriangle } from "react-icons/fi";
import { MdOutlineDateRange, MdAccessTime } from "react-icons/md";
import ResponsivePagination from "react-responsive-pagination";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MobileNav } from "@/components/mobile-nav";

interface User {
  _id: string;
  name: string;
  profilePicture?: string;
  role?: string;
  status?: string;
  email?: string;
}

enum PenaltyType {
  LATE_PAYMENT = "LATE_PAYMENT",
  DAMAGE = "DAMAGE",
  RULE_VIOLATION = "RULE_VIOLATION",
  OTHER = "OTHER"
}

interface Penalty {
  _id: string;
  userId: string | User;
  type: PenaltyType;
  amount: number;
  description: string;
  createdAt: string;
  image?: string;
}

interface PenaltyTimerData {
  lastPenaltyAppliedAt: string;
  warningPeriodDays: number;
}

// Penalty Timer Component
function PenaltyTimer() {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const { data: timerData } = useQuery<PenaltyTimerData>({
    queryKey: ["/api/penalty-timers"],
  });

  useEffect(() => {
    if (timerData) {
      const updateTimer = () => {
        const lastPenalty = new Date(timerData.lastPenaltyAppliedAt);
        const warningDays = timerData.warningPeriodDays;
        const nextPenaltyDate = new Date(lastPenalty);
        nextPenaltyDate.setDate(nextPenaltyDate.getDate() + warningDays);
        const now = new Date();
        const diffTime = nextPenaltyDate.getTime() - now.getTime();

        if (diffTime > 0) {
          const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);
          setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining("Penalty Due");
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [timerData]);

  if (!timerData) return null;

  return (
    <div className="flex items-center justify-between p-2 bg-indigo-700 text-white rounded-md shadow-md">
      <div className="flex items-center gap-2">
        <MdAccessTime className="text-xl" />
        <span className="font-semibold text-sm">Next Penalty In:</span>
      </div>
      <span className="text-sm font-mono font-semibold">{timeRemaining}</span>
    </div>
  );
}

// Penalty Settings Form Component
export function PenaltySettingsForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [penaltyPercentage, setPenaltyPercentage] = useState<number>(3);
  const [warningDays, setWarningDays] = useState<number>(3);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Fetch users with proper typing
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<PenaltySettings>({
    queryKey: ["/api/penalty-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/penalty-settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    staleTime: 0,
  });

  // Update settings when they load
  useEffect(() => {
    if (settings) {
      setPenaltyPercentage(settings.contributionPenaltyPercentage);
      setWarningDays(settings.warningPeriodDays);
      setSelectedUsers(settings.selectedUsers.map(id => id.toString()));
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    updateSettingsMutation.mutate({
      contributionPenaltyPercentage: penaltyPercentage,
      warningPeriodDays: warningDays,
      selectedUsers: selectedUsers,
    });
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: PenaltySettings) => {
      const res = await apiRequest("PATCH", "/api/penalty-settings", data);
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/penalty-settings"] });
      toast({
        title: "Settings Updated",
        description: "Penalty settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => setLoading(false),
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-white p-1 sm:p-6 rounded-lg">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[blob_7s_infinite]"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[blob_7s_infinite_2s]"></div>
      <div className="absolute -bottom-8 left-20 w-32 h-32 bg-pink-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[blob_7s_infinite_4s]"></div>

      <form onSubmit={handleSubmit} className="relative space-y-8">
        <div className="space-y-6">
          {/* Title and Description */}
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Penalty Configuration
            </h2>
            <p className="text-sm text-gray-500">
              Configure penalty settings for your flat members
            </p>
          </div>

          {/* Penalty Percentage Slider with Glass Effect */}
          <div className="backdrop-blur-md bg-white/80 p-6 rounded-lg shadow-xl border border-white/50 transition-all duration-300 hover:shadow-2xl hover:bg-white/90">
            <div className="flex justify-between items-center mb-3">
              <Label htmlFor="penaltyPercentage" className="text-indigo-900 font-semibold">
                Penalty Percentage
              </Label>
              <span className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded-full shadow-sm">
                {penaltyPercentage}%
              </span>
            </div>
            <Slider
              id="penaltyPercentage"
              min={1}
              max={10}
              step={0.5}
              value={[penaltyPercentage]}
              onValueChange={(value) => setPenaltyPercentage(value[0])}
              className="py-4"
            />
            <p className="text-xs text-gray-500 mt-2 italic">
              Percentage applied as penalty for contributions below fair share
            </p>
          </div>

          {/* Warning Period Slider with Glass Effect */}
          <div className="backdrop-blur-md bg-white/80 p-6 rounded-lg shadow-xl border border-white/50 transition-all duration-300 hover:shadow-2xl hover:bg-white/90">
            <div className="flex justify-between items-center mb-3">
              <Label htmlFor="warningDays" className="text-indigo-900 font-semibold">
                Warning Period
              </Label>
              <span className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded-full shadow-sm">
                {warningDays} days
              </span>
            </div>
            <Slider
              id="warningDays"
              min={1}
              max={7}
              step={1}
              value={[warningDays]}
              onValueChange={(value) => setWarningDays(value[0])}
              className="py-4"
            />
            <p className="text-xs text-gray-500 mt-2 italic">
              Grace period before applying the next penalty
            </p>
          </div>

          {/* User Selection with Glass Effect */}
          <div className="backdrop-blur-md bg-white/80 p-6 rounded-lg shadow-xl border border-white/50 transition-all duration-300 hover:shadow-2xl hover:bg-white/90">
            <Label className="text-indigo-900 font-semibold mb-3 block">
              Select Users
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-400 scrollbar-track-indigo-100 pr-2">
              {users.map((user) => (
                <div
                  key={user._id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${selectedUsers.includes(user._id)
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 shadow-md'
                    : 'bg-white/50 hover:bg-white hover:shadow-md'
                    } border`}
                >
                  <Checkbox
                    id={user._id}
                    checked={selectedUsers.includes(user._id)}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) {
                        setSelectedUsers([...selectedUsers, user._id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user._id));
                      }
                    }}
                    className="border-indigo-300"
                  />
                  <label
                    htmlFor={user._id}
                    className="flex items-center gap-3 text-sm font-medium text-gray-700 hover:text-indigo-600 cursor-pointer flex-1"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
                        <img
                          src={user.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"}
                          alt={user.name}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      </div>
                      {selectedUsers.includes(user._id) && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-4 h-4 border-2 border-white flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="flex-1 truncate">{user.name}</span>
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 italic">
              Leave unselected to apply penalties to all users
            </p>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-lg shadow-lg transition-all duration-300 transform hover:shadow-2xl ${loading
            ? 'bg-gray-400'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:-translate-y-0.5'
            }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-white font-medium">Updating...</span>
            </div>
          ) : (
            <span className="text-white font-medium">Save Settings</span>
          )}
        </Button>
      </form>
    </div>
  );
}




// Create a separate component for editing a penalty
function EditPenaltyDialog({ penalty }: { penalty: Penalty }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    fetch(`/api/penalties/${penalty._id}`, {
      method: "DELETE",
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
        toast({
          title: "Penalty Deleted",
          description: `Penalty has been deleted successfully.`,
          variant: "destructive",
        });
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to update penalty. Please try again.",
          variant: "destructive",
        });
      });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {/* Edit Button with Icon */}
          <button
            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition"
            onClick={() => setOpen(true)}
          >
            <FaEdit className="text-lg" />
          </button>
        </DialogTrigger>
        {/* Delete Button with Icon */}
        <button
          className="p-2 text-red-600 hover:bg-blue-100 rounded-full transition"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <FaTrash className="text-lg" />
        </button>

        <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-indigo-100 border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Edit Penalty</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              fetch(`/api/penalties/${penalty._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: formData.get("type"),
                  amount: parseFloat(formData.get("amount") as string),
                  description: formData.get("description"),
                }),
              })
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
                  toast({
                    title: "Penalty Updated",
                    description: `Penalty has been updated successfully.`,
                  });
                  setOpen(false); // Close the dialog on success
                })
                .catch(() => {
                  toast({
                    title: "Error",
                    description: "Failed to update penalty. Please try again.",
                    variant: "destructive",
                  });
                });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="type">Penalty Type</Label>
              <Select name="type" defaultValue={penalty.type}>
                <SelectTrigger>
                  <SelectValue placeholder="Select penalty type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LATE_PAYMENT">Late Payment</SelectItem>
                  <SelectItem value="DAMAGE">Damage</SelectItem>
                  <SelectItem value="RULE_VIOLATION">Rule Violation</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                name="amount"
                type="number"
                defaultValue={penalty.amount}
                placeholder="Amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                name="description"
                defaultValue={penalty.description}
                placeholder="Description"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
              />
            </div>

            <Button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
            >
              <span>Update Penalty</span>
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Penalty"
        description={`Are you sure you want to delete this penalty? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

export default function PenaltiesPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [newPenalty, setNewPenalty] = useState({
    userId: "",
    type: "LATE_PAYMENT" as PenaltyType,
    amount: "",
    description: "",
    image: "",
  });
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const penaltiesPerPage = 6;
  const [selectedPenalties, setSelectedPenalties] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const isAdmin = user?.role === "ADMIN";

  const { data: penalties } = useQuery<Penalty[]>({
    queryKey: ["/api/penalties"]
  });

  const { data: totals } = useQuery<{ userTotal: number; flatTotal: number }>({
    queryKey: ["/api/penalties/total"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  // Function to handle selecting/deselecting all penalties
  const handleSelectAll = (checked: boolean) => {
    if (checked && penalties) {
      setSelectedPenalties(penalties.map(penalty => penalty._id));
    } else {
      setSelectedPenalties([]);
    }
  };

  // Function to handle selecting/deselecting a single penalty
  const handleSelectPenalty = (penaltyId: string, checked: boolean) => {
    if (checked) {
      setSelectedPenalties(prev => [...prev, penaltyId]);
    } else {
      setSelectedPenalties(prev => prev.filter(id => id !== penaltyId));
    }
  };

  // Function to handle bulk deletion
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = () => {
    if (selectedPenalties.length === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    Promise.all(selectedPenalties.map(id => {
      return fetch(`/api/penalties/${id}`, {
        method: "DELETE",
      });
    }))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
        toast({
          title: "Penalties Deleted",
          description: `${selectedPenalties.length} penalties have been deleted successfully.`,
          variant: "destructive",
        });
        setSelectedPenalties([]);
        setBulkDeleteDialogOpen(false);
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to delete penalties. Please try again.",
          variant: "destructive",
        });
        setBulkDeleteDialogOpen(false);
      });
  };

  // Reverse penalties and apply pagination
  const paginatedPenalties = penalties?.slice(
    (currentPage - 1) * penaltiesPerPage,
    currentPage * penaltiesPerPage
  );


  const totalPages = Math.ceil((penalties?.length || 0) / penaltiesPerPage);

  const addPenaltyMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      type: PenaltyType;
      amount: number;
      description: string;
      image?: string;
    }) => {
      const res = await apiRequest("POST", "/api/penalties", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
      toast({ title: "Penalty added successfully" });
      setOpenAddDialog(false);
      setNewPenalty({
        userId: "",
        type: "LATE_PAYMENT",
        amount: "",
        description: "",
        image: "",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPenalty.userId || !newPenalty.amount || !newPenalty.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    addPenaltyMutation.mutate({
      userId: newPenalty.userId,
      type: newPenalty.type,
      amount: parseFloat(newPenalty.amount),
      description: newPenalty.description,
      image: newPenalty.image,
    });
  };

  // Function to format penalty type for display
  const formatPenaltyType = (type: PenaltyType) => {
    switch (type) {
      case "LATE_PAYMENT":
        return "Late Payment";
      case "DAMAGE":
        return "Damage";
      case "RULE_VIOLATION":
        return "Rule Violation";
      case "OTHER":
        return "Other";
      default:
        return type;
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen p-8 pb-24 pt-32 bg-gradient-to-r from-indigo-600 via-[#241e95] to-indigo-800">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-lg bg-gradient-to-r from-slate-900 via-[#241e95] to-indigo-100 p-5 flex flex-wrap justify-between items-center gap-4 mb-8">
            <h1 className="text-2xl sm:text-3xl text-white font-bold">Penalties</h1>


            <div className="flex gap-2">
              {/* Settings Button */}
              {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-white hover:bg-gray-100 text-indigo-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                      Settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    aria-describedby="penalty-settings-description"
                    className="max-w-3xl w-full p-0 rounded-lg border-none shadow-2xl bg-white sm:rounded-lg overflow-hidden"
                  >
                    <DialogHeader className="px-6 pt-6 pb-2 border-b">
                      <DialogTitle className="text-xl font-semibold text-indigo-700">Penalty Settings</DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[80vh] overflow-y-auto p-6">
                      <PenaltySettingsForm />
                    </div>
                  </DialogContent>

                </Dialog>
              )}

              <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition">
                    <span>Add Penalty</span>
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-indigo-100 border border-gray-200">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-gray-800">Add New Penalty</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="userId">Select User</Label>
                      <Select
                        value={newPenalty.userId}
                        onValueChange={(value) => setNewPenalty({ ...newPenalty, userId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.map((user: any) => (
                            <SelectItem key={user._id} value={user._id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="type">Penalty Type</Label>
                      <Select
                        value={newPenalty.type}
                        onValueChange={(value: PenaltyType) => setNewPenalty({ ...newPenalty, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select penalty type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LATE_PAYMENT">Late Payment</SelectItem>
                          <SelectItem value="DAMAGE">Damage</SelectItem>
                          <SelectItem value="RULE_VIOLATION">Rule Violation</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={newPenalty.amount}
                        onChange={(e) => setNewPenalty({ ...newPenalty, amount: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        placeholder="Description"
                        value={newPenalty.description}
                        onChange={(e) => setNewPenalty({ ...newPenalty, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none transition"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={addPenaltyMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                    >
                      <span>Add Penalty</span>
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 mb-8">
            <Card className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-xl border border-white/10 rounded-lg">
              <div
                className="w-full overflow-x-auto px-4 py-4 bg-transparent rounded-t-lg"
                style={{
                  scrollbarWidth: "none", // Hide scrollbar for Firefox
                  msOverflowStyle: "none", // Hide scrollbar for IE/Edge
                }}
              >

                <div className="flex space-x-6 min-w-max ">
                  {penalties && Array.isArray(penalties) && penalties.length > 0 ? (
                    (() => {
                      const totalPenaltiesGlobal = penalties
                        .reduce((sum, penalty) => sum + (penalty.amount || 0), 0) || 1; // Avoid division by zero

                      return Array.from(new Set(penalties.map((p) =>
                        typeof p.userId === 'object' ? p.userId._id : p.userId
                      ))).map((userId) => {
                        const userPenalties = penalties.filter((p) =>
                          (typeof p.userId === 'object' ? p.userId._id : p.userId) === userId
                        );

                        const totalUserAmount = userPenalties.reduce((sum, penalty) => sum + (penalty.amount || 0), 0);

                        const userName = (typeof userPenalties[0]?.userId === 'object' && userPenalties[0]?.userId?.name) ||
                          (users?.find(u => u._id === userId)?.name) || "User";

                        const userProfile = (typeof userPenalties[0]?.userId === 'object' && userPenalties[0]?.userId?.profilePicture) ||
                          users?.find(u => u._id === userId)?.profilePicture ||
                          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s";

                        const progressPercentage = Math.min((totalUserAmount / totalPenaltiesGlobal) * 100, 100).toFixed(0);

                        // Color Logic
                        const getBorderColor = () => {
                          if (progressPercentage >= 81) return "#FF4500"; // Red (81-100%)
                          if (progressPercentage >= 51) return "#FFD700"; // Yellow (51-80%)
                          return "#00FF00"; // Green (0-50%)
                        };

                        // Calculate position for percentage text
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

                              {/* Percentage Text at Progress End Point */}
                              <div
                                className="absolute text-[10px] sm:text-xs font-semibold"
                                style={{
                                  transform: `translate(${textX}px, ${textY}px)`,
                                  left: "50%",
                                  top: "50%",
                                  whiteSpace: "nowrap",
                                  padding: "2px 4px",
                                  background: "rgba(0, 0, 0, 0.75)",
                                  borderRadius: "4px",
                                  color: getBorderColor(),
                                }}
                              >
                                {progressPercentage}%
                              </div>
                            </div>

                            {/* Premium Divider Line */}
                            <div className="w-[2px] h-12 bg-gradient-to-b from-indigo-400 via-purple-500 to-pink-500 shadow-md rounded-full"></div>

                            {/* User Info */}
                            <div className="text-xs text-white/80 flex flex-col gap-y-1">
                              <div className="font-semibold text-sm">{userName}</div>
                              <div className="text-white/60">{userPenalties.length} Penalties</div>
                              <div className="font-bold text-red-400">₹{totalUserAmount.toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="text-white/60 text-sm">No penalties found</div>
                  )}
                </div>
              </div>

              <CardHeader>
                <CardTitle className="text-lg font-semibold">Overall Penalties</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">

                <div className="flex justify-between items-center">
                  <span className="text-white/80">Total Amount:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-red-400 text-lg">
                      ₹
                      {penalties && Array.isArray(penalties) && penalties.length > 0
                        ? penalties
                          .reduce((sum, penalty) => sum + (penalty.amount || 0), 0)
                          .toFixed(2)
                        : "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {penalties && Array.isArray(penalties) && penalties.length > 0
                        ? penalties.length
                        : 0}{" "}
                      Penalties
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
                  <span className="text-white/80">Your Total Penalties:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-red-400 text-lg">
                      ₹{totals?.userTotal?.toFixed(2) || "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {penalties?.filter(p => {
                        // Handle different userId formats
                        const penaltyUserId = typeof p.userId === 'object' && p.userId !== null
                          ? (p.userId._id || p.userId.id || p.userId)
                          : p.userId;

                        const userIdStr = penaltyUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();

                        return userIdStr === currentUserIdStr;
                      }).length || 0} Penalties
                    </div>
                  </div>
                </div>

                {/* Flat Total */}
                {/* <div className="flex justify-between items-center">
                  <span className="text-white/80">Flat Total Penalties:</span>
                  <div className="text-end sm:text-right">
                    <div className="font-bold text-yellow-400 text-lg">
                      ₹{totals?.flatTotal?.toFixed(2) || "0.00"}
                    </div>
                    <div className="text-sm text-white/60">
                      {penalties?.length || 0} Penalties
                    </div>
                  </div>
                </div> */}

                {/* User Role & Status */}
                <div className="mt-4 flex flex-col space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/70">Role:</span>
                    <span className="font-semibold text-white">{user?.role || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Status:</span>
                    <span className="font-semibold text-white">{user?.status || "Unknown"}</span>
                  </div>
                </div>

                <PenaltyTimer />

              </CardContent>
            </Card>
          </div>

          {/* Penalties Table */}
          <div className=" rounded-lg shadow-md overflow-hidden ">
            <div className="p-4 bg-indigo-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-800">All Penalties</h2>

              {selectedPenalties.length > 0 && (
                <Button
                  onClick={handleBulkDelete}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <FaTrash className="h-3 w-3" />
                  Delete Selected ({selectedPenalties.length})
                </Button>
              )}
            </div>

            <div className="overflow-x-auto bg-indigo-100">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-300">

                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>

                    {isAdmin && <TableHead>Actions</TableHead>}
                    {isAdmin &&
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          checked={penalties?.length > 0 && selectedPenalties.length === penalties.length}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </TableHead>}

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPenalties?.length > 0 ? (
                    paginatedPenalties.map((penalty) => (
                      <TableRow key={penalty._id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                typeof penalty.userId === "object" && penalty.userId?.profilePicture
                                  ? penalty.userId.profilePicture
                                  : users?.find((u) =>
                                    u._id ===
                                    (typeof penalty.userId === "string" ? penalty.userId : penalty.userId?._id)
                                  )?.profilePicture ||
                                  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"
                              }
                              alt="User"
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src =
                                  "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                              }}
                            />
                            <span>
                              {typeof penalty.userId === "object" && penalty.userId?.name
                                ? penalty.userId.name
                                : users?.find((u) =>
                                  u._id ===
                                  (typeof penalty.userId === "string" ? penalty.userId : penalty.userId?._id)
                                )?.name || "User"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {formatPenaltyType(penalty.type)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-red-600">₹{penalty.amount.toFixed(2)}</TableCell>
                        <TableCell className="max-w-xs truncate">{penalty.description}</TableCell>
                        <TableCell>{new Date(penalty.createdAt).toLocaleDateString()}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex space-x-1">
                              <EditPenaltyDialog penalty={penalty} />
                            </div>
                          </TableCell>
                        )}
                        {isAdmin && (
                          <TableCell>
                            <input
                              type="checkbox"
                              onChange={(e) => handleSelectPenalty(penalty._id, e.target.checked)}
                              checked={selectedPenalties.includes(penalty._id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                        No penalties found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>


              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200">
                <ResponsivePagination
                  current={currentPage}
                  total={totalPages}
                  onPageChange={setCurrentPage}
                  maxWidth={42}
                />
              </div>
            )}
          </div>

          {/* Confirmation Dialog for Bulk Delete */}
          <ConfirmDialog
            open={bulkDeleteDialogOpen}
            onOpenChange={setBulkDeleteDialogOpen}
            title="Delete Selected Penalties"
            description={`Are you sure you want to delete ${selectedPenalties.length} selected penalties? This action cannot be undone.`}
            onConfirm={confirmBulkDelete}
            confirmText="Delete"
            cancelText="Cancel"
          />

        </div >
      </div>

      {/* Mobile Navigation */}
      <div className="block md:hidden">
        <MobileNav />
      </div>
    </>

  );
}