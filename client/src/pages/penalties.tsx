import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FaUserCircle, FaEdit, FaTrash, FaClipboardList } from "react-icons/fa";
import { BsThreeDots } from "react-icons/bs";
import { Settings, Plus } from "lucide-react";
import { MdOutlineDateRange, MdAccessTime, MdAttachMoney, MdTimer, MdTimerOff, MdCalendarToday, MdGroup, MdPersonAdd, MdCheck } from "react-icons/md";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MobileNav } from "@/components/mobile-nav";
import { CustomPagination } from "@/components/custom-pagination";

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
    <div className="relative group">
      {/* Animated gradient border with glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6636a3] via-purple-500 to-[#6636a3] rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-500 animate-gradient-x"></div>

      {/* Main content with glass effect */}
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 bg-black/50 backdrop-blur-lg rounded-lg border border-white/10 shadow-xl transition-all duration-300 group-hover:bg-black/60 group-hover:scale-[1.02] w-full">
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* Icon background with pulse effect */}
            <div className="absolute -inset-0.5 bg-[#6636a3] rounded-full blur opacity-50 group-hover:opacity-75 transition duration-300"></div>
            <div className="relative p-2.5 bg-[#6636a3]/20 rounded-full border border-[#6636a3]/30 group-hover:bg-[#6636a3]/30 transition duration-300">
              <MdAccessTime className="text-xl text-[#6636a3] group-hover:scale-110 transform transition duration-300" />
            </div>
          </div>
          <span className="font-medium text-sm text-white/90 tracking-wide">Next Penalty In:</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-sm font-mono font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-[#6636a3]/20 to-purple-500/20 border border-[#6636a3]/30 text-white/90 shadow-inner">
            {timeRemaining}
          </span>
        </div>
      </div>

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
        <div className="animate-spin h-8 w-8 border-4 border-[#6636a3] border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#151525] p-4 sm:p-6 rounded-lg">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-[#6636a3]/20 rounded-full mix-blend-multiply filter blur opacity-70 animate-[blob_7s_infinite]"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[blob_7s_infinite_2s]"></div>
      <div className="absolute -bottom-8 left-20 w-32 h-32 bg-[#6636a3]/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[blob_7s_infinite_4s]"></div>



      <form onSubmit={handleSubmit} className="relative space-y-6 overflow-hidden">

        {/* Title */}
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-2xl font-bold text-white">Penalty Configuration</h2>
          <p className="text-sm text-gray-400">Configure penalty settings for your flat members</p>
        </div>

        {/* Penalty Percentage */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6636a3] via-purple-500 to-[#6636a3] rounded-xl blur opacity-60 group-hover:opacity-75 transition duration-300"></div>

          <div className="relative backdrop-blur-md bg-black/40 p-6 rounded-xl border border-[#6636a3]/30 hover:bg-black/50">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#6636a3] rounded-full blur opacity-50"></div>
                  <div className="relative p-2.5 bg-[#6636a3]/20 rounded-full border border-[#6636a3]/30">
                    <MdAttachMoney className="text-xl text-[#6636a3]" />
                  </div>
                </div>
                <Label htmlFor="penaltyPercentage" className="text-lg font-semibold text-white">Penalty Percentage</Label>
              </div>
              <span className="text-lg font-bold text-white px-4 py-1.5 rounded-full bg-[#6636a3]/30 border border-[#6636a3]/50">{penaltyPercentage}%</span>
            </div>
            <div className="space-y-4">
              <Slider
                id="penaltyPercentage"
                min={1}
                max={10}
                step={0.5}
                value={[penaltyPercentage]}
                onValueChange={(value) => setPenaltyPercentage(value[0])}
                className="py-4"
              />
              <p className="text-sm text-gray-400 italic">Percentage applied as penalty for contributions below fair share</p>
            </div>
          </div>
        </div>

        {/* Warning Period */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6636a3] via-purple-500 to-[#6636a3] rounded-xl blur opacity-60 group-hover:opacity-75 transition duration-300"></div>


          <div className="relative backdrop-blur-md bg-black/40 p-4 sm:p-6 rounded-xl border border-[#6636a3]/30 hover:bg-black/50 transition-all duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#6636a3] rounded-full blur opacity-50"></div>
                  <div className="relative p-2.5 bg-[#6636a3]/20 rounded-full border border-[#6636a3]/30">
                    <MdTimerOff className="text-xl text-[#6636a3]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="warningDays" className="text-base sm:text-lg font-semibold text-white">
                    Warning Period
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Set grace period before penalties
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#6636a3]/10 p-1 rounded-lg border border-[#6636a3]/20 w-full sm:w-auto">
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg">
                  <MdCalendarToday className="text-[#6636a3] flex-shrink-0" />
                  <span className="text-white/80 hidden sm:inline">Days:</span>
                </span>
                <span className="text-lg font-bold text-white px-4 py-1.5 rounded-lg bg-[#6636a3]/30 border border-[#6636a3]/50 flex-grow text-center sm:text-left sm:flex-grow-0">
                  {warningDays}
                </span>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-4">
              <div className="relative py-3">
                <Slider
                  id="warningDays"
                  min={1}
                  max={7}
                  step={1}
                  value={[warningDays]}
                  onValueChange={(value) => setWarningDays(value[0])}
                  className="py-4"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <span>Min: 1 day</span>
                <span>Max: 7 days</span>
              </div>
            </div>
          </div>


        </div>



        {/* Select Users */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6636a3] via-purple-500 to-[#6636a3] rounded-xl blur opacity-60 group-hover:opacity-75 transition duration-300"></div>

          <div className="relative backdrop-blur-md bg-black/40 p-6 rounded-xl border border-[#6636a3]/30 hover:bg-black/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#6636a3] rounded-full blur opacity-50"></div>
                  <div className="relative p-2.5 bg-[#6636a3]/20 rounded-full border border-[#6636a3]/30">
                    <MdGroup className="text-xl text-[#6636a3]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-white">Select Users</Label>
                  <p className="text-sm text-gray-400">Choose users for penalty application</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-[#6636a3]/10 px-3 py-1.5 rounded-lg border border-[#6636a3]/20">
                <MdPersonAdd className="text-[#6636a3]" />
                <span className="text-white/80 text-sm">{selectedUsers.length} Selected</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-1 sm:pr-2">
              {users?.map((user) => (
                <div
                  key={user._id}
                  className={`group/card relative flex items-center gap-3 flex-wrap sm:flex-nowrap p-4 rounded-xl w-full transition-all duration-300 ${selectedUsers.includes(user._id)
                    ? 'bg-[#6636a3]/20 border-[#6636a3]/50 shadow-lg'
                    : 'bg-black/30 hover:bg-black/40 hover:shadow-lg'
                    } border border-[#6636a3]/30`}
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
                    className="peer hidden"
                  />
                  <label htmlFor={user._id} className="flex items-center gap-4 cursor-pointer w-full min-w-0">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[#6636a3]/30 shadow-sm transition-transform duration-300 group-hover/card:scale-105">
                        <img
                          src={
                            user?.profilePicture
                            || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"
                          }
                          alt={user?.name || "User"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                          }}
                        />
                      </div>

                      {selectedUsers.includes(user._id) && (
                        <div className="absolute -bottom-1 -right-1 bg-[#6636a3] rounded-lg w-5 h-5 border-2 border-black flex items-center justify-center shadow-lg">
                          <MdCheck className="text-white text-sm" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 break-words whitespace-normal">{user.email}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${selectedUsers.includes(user._id)
                      ? 'bg-[#6636a3] border-[#6636a3]'
                      : 'border-[#6636a3]/30 group-hover/card:border-[#6636a3]/50'
                      }`}>
                      <MdCheck className={`text-lg transition-all duration-300 ${selectedUsers.includes(user._id)
                        ? 'text-white scale-100'
                        : 'text-[#6636a3]/30 scale-75'
                        }`} />
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#6636a3]/20">
              <p className="text-xs text-gray-400 italic">
                Leave unselected to apply penalties to all users
              </p>
              <div className="sm:hidden flex items-center space-x-2 bg-[#6636a3]/10 px-3 py-1.5 rounded-lg border border-[#6636a3]/20">
                <MdPersonAdd className="text-[#6636a3]" />
                <span className="text-white/80 text-[15px] whitespace-nowrap">
                  {selectedUsers.length} Selected
                </span>
              </div>

            </div>
          </div>
        </div>



        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-lg shadow-lg transition-all duration-300 transform hover:shadow-2xl ${loading
            ? 'bg-gray-600'
            : 'bg-[#6636a3] hover:bg-[#542d87] hover:-translate-y-0.5'
            }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Updating...</span>
            </div>
          ) : (
            <span className="font-medium">Save Settings</span>
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

  const queryClient = useQueryClient();
  const handleDelete = () => {
    fetch(`/api/penalties/${penalty._id}`, {
      method: "DELETE",
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
        toast({
          title: "Success",
          description: `Penalty has been deleted successfully.`,
        });
        setDeleteDialogOpen(false);
      })
      .catch((error) => {
        console.error("Delete error:", error);
        toast({
          title: "Error",
          description: "Failed to delete penalty. Please try again.",
          variant: "destructive",
        });
      });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center space-x-2">
          <DialogTrigger asChild>
            {/* Edit Button with Icon */}
            <button
              className="p-1.5 text-[#6636a3] hover:bg-white/5 rounded-full transition-all duration-200"
              onClick={() => setOpen(true)}
            >
              <FaEdit className="text-lg" />
            </button>
          </DialogTrigger>
          {/* Delete Button with Icon */}
          <button
            className="p-1.5 text-red-500/80 hover:bg-white/5 hover:text-red-500 rounded-full transition-all duration-200"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <FaTrash className="text-lg" />
          </button>
        </div>

        <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#6636a3]/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Edit Penalty</DialogTitle>
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
                .then((response) => {
                  if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                  }
                  return response.json();
                })
                .then((data) => {
                  queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
                  toast({
                    title: "Success",
                    description: `Penalty has been updated successfully.`,
                  });
                  setOpen(false); // Close the dialog on success
                })
                .catch((error) => {
                  console.error("Update error:", error);
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
              <Label htmlFor="type" className="text-white/90">Penalty Type</Label>
              <Select name="type" defaultValue={penalty.type || undefined}>
                <SelectTrigger className="border border-white/10 bg-black/30 text-white">
                  <SelectValue className="text-white" placeholder="Select penalty type" />
                </SelectTrigger>
                <SelectContent className="bg-[#151525] border border-[#6636a3]/30">
                  <SelectItem value="LATE_PAYMENT" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-white focus:bg-[#6636a3]/30 cursor-pointer">Late Payment</SelectItem>
                  <SelectItem value="DAMAGE" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-white focus:bg-[#6636a3]/30 cursor-pointer">Damage</SelectItem>
                  <SelectItem value="RULE_VIOLATION" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-white focus:bg-[#6636a3]/30 cursor-pointer">Rule Violation</SelectItem>
                  <SelectItem value="OTHER" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-white focus:bg-[#6636a3]/30 cursor-pointer">Other</SelectItem>
                </SelectContent>
              </Select>

            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-white/90">Amount</Label>
              <Input
                name="amount"
                type="number"
                defaultValue={penalty.amount}
                placeholder="Amount"
                className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#6636a3] outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white/90">Description</Label>
              <Textarea
                name="description"
                defaultValue={penalty.description}
                placeholder="Description"
                className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#6636a3] outline-none transition"
              />
            </div>

            <Button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-[#6636a3] hover:bg-[#542d87] text-white rounded-lg shadow-md transition"
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
      .then(responses => {
        // Check if any response is not ok
        const failedResponses = responses.filter(response => !response.ok);
        if (failedResponses.length > 0) {
          throw new Error(`${failedResponses.length} deletions failed`);
        }
        return responses;
      })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
        toast({
          title: "Success",
          description: `${selectedPenalties.length} penalties have been deleted successfully.`,
        });
        setSelectedPenalties([]);
        setBulkDeleteDialogOpen(false);
      })
      .catch((error) => {
        console.error("Bulk delete error:", error);
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

  const queryClient = useQueryClient();

  const addPenaltyMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      type: PenaltyType;
      amount: number;
      description: string;
      image?: string;
    }) => {
      try {
        const res = await apiRequest("POST", "/api/penalties", data);
        return res.json();
      } catch (error) {
        console.error("Add penalty error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
      toast({
        title: "Success",
        description: "Penalty added successfully"
      });
      setOpenAddDialog(false);
      setNewPenalty({
        userId: "",
        type: "LATE_PAYMENT",
        amount: "",
        description: "",
        image: "",
      });
    },
    onError: (error) => {
      console.error("Add penalty error:", error);
      toast({
        title: "Error",
        description: "Failed to add penalty. Please try again.",
        variant: "destructive",
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
    <TooltipProvider>
      <Header />
      <div className="min-h-screen p-8 pt-28 bg-[#0f0f1f]">
        <div className="max-w-7xl mx-auto">
          <div className="relative group mb-8">
            {/* Blurred border layer */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>

            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10 flex flex-wrap justify-between items-center gap-4 mb-8">
              <h1 className="text-2xl sm:text-3xl text-white font-bold">Penalties</h1>


              <div className="flex gap-2">
                {/* Settings Button */}
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 bg-white/80 hover:bg-white/90 text-gray-700">
                        <Settings className="h-5 w-5" />
                        Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent
                      aria-describedby="penalty-settings-description"
                      className="max-w-3xl w-full m-0 sm:mx-0  p-0 rounded-lg border-[#6636a3]/30 shadow-2xl bg-[#151525] sm:rounded-lg overflow-hidden"
                    >

                      <DialogHeader className="px-6 pt-6 pb-2 border-b border-[#6636a3]/30">
                        <DialogTitle className="text-xl font-semibold text-white">Penalty Settings</DialogTitle>
                      </DialogHeader>

                      <div className="max-h-[80vh] overflow-y-auto p-6">
                        <PenaltySettingsForm />
                      </div>
                    </DialogContent>

                  </Dialog>
                )}

                <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2 px-4 py-2 bg-[#6636a3] text-white rounded-lg shadow-md transition hover:bg-[#542d87]">
                      <Plus className="h-5 w-5" />
                      <span>Add Penalty</span>
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#6636a3]/30">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-white">Add New Penalty</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Select User */}
                      <div className="space-y-2">
                        <Label className="text-white/90" htmlFor="userId">Select User</Label>
                        <Select
                          value={newPenalty.userId}
                          onValueChange={(value) => setNewPenalty({ ...newPenalty, userId: value })}
                        >
                          <SelectTrigger className="border border-white/10 bg-[#151525] text-white focus:ring-2 focus:ring-[#6636a3] outline-none transition">
                            {/* Lighter placeholder text */}
                            <SelectValue
                              placeholder="Select a user"
                              className="text-white/80"
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-[#151525] border border-[#6636a3]/30">
                            {users?.map((user: any) => (
                              <SelectItem
                                key={user._id}
                                value={user._id}
                                className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-text-white focus:bg-[#6636a3]/30 cursor-pointer"
                              >
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Penalty Type */}
                      <div className="space-y-2">
                        <Label htmlFor="type" className="text-white/90">Penalty Type</Label>
                        <Select
                          value={newPenalty.type}
                          onValueChange={(value: PenaltyType) => setNewPenalty({ ...newPenalty, type: value })}
                        >
                          <SelectTrigger className="border border-white/10 bg-[#151525] text-white focus:ring-2 focus:ring-[#6636a3] outline-none transition">
                            <SelectValue placeholder="Select penalty type" className="text-white/80" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#151525] border border-[#6636a3]/30">
                            <SelectItem value="LATE_PAYMENT" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-text-white focus:bg-[#6636a3]/30 cursor-pointer">Late Payment</SelectItem>
                            <SelectItem value="DAMAGE" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-text-white focus:bg-[#6636a3]/30 cursor-pointer">Damage</SelectItem>
                            <SelectItem value="RULE_VIOLATION" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-text-white focus:bg-[#6636a3]/30 cursor-pointer">Rule Violation</SelectItem>
                            <SelectItem value="OTHER" className="text-white hover:bg-[#6636a3]/30 hover:text-white focus:text-text-white focus:bg-[#6636a3]/30 cursor-pointer">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Amount Input */}
                      <div className="space-y-2">
                        <Label className="text-white/90" htmlFor="amount">Amount</Label>
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={newPenalty.amount}
                          onChange={(e) => setNewPenalty({ ...newPenalty, amount: e.target.value })}
                          className="w-full px-4 py-2 border border-white/10 bg-[#151525] text-white rounded-lg focus:ring-2 focus:ring-[#6636a3] outline-none transition"
                        />
                      </div>

                      {/* Description Textarea */}
                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-white/90">Description</Label>
                        <Textarea
                          placeholder="Description"
                          value={newPenalty.description}
                          onChange={(e) => setNewPenalty({ ...newPenalty, description: e.target.value })}
                          className="w-full px-4 py-2 border border-white/10 bg-[#151525] text-white rounded-lg focus:ring-2 focus:ring-[#6636a3] outline-none transition"
                        />
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        disabled={addPenaltyMutation.isPending}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#6636a3] hover:bg-[#542d87] text-white rounded-lg shadow-md transition"
                      >
                        <span>Add Penalty</span>
                      </Button>
                    </form>

                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 mb-8">
            <Card className="bg-[#6636a3] text-white shadow-xl border border-white/10 rounded-lg">
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

            <Card className="bg-[#6636a3] text-white shadow-xl border border-white/10 rounded-lg p-4">
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



          {selectedPenalties.length > 0 && (
            <div className="mb-4 flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-[#6636a3] hover:bg-[#542d87] text-white rounded-lg shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTrash className="text-sm" />
                Delete Selected ({selectedPenalties.length})
              </Button>
            </div>
          )}

          <Table className="w-full overflow-x-auto bg-[#151525] rounded-xl" >
            <TableHeader>
              <TableRow className="border-none">

                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap min-w-[200px]">
                  <span className="block">User</span>
                </TableHead>
                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-10 border-none whitespace-nowrap min-w-[180px]">
                  <span className="block">Type</span>
                </TableHead>
                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap">
                  <span className="block">Amount</span>
                </TableHead>
                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none min-w-[160px]">
                  <span className="block whitespace-nowrap">Description</span>
                </TableHead>
                <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none min-w-[160px]">
                  <span className="block whitespace-nowrap">Date & Time</span>
                </TableHead>


                {isAdmin && <TableHead className="text-center text-indigo-200/80 font-semibold py-3 border-none">Actions</TableHead>}
                {isAdmin &&
                  <TableHead className="w-10 text-center text-indigo-200/80 font-semibold py-3 border-[#6636a3]">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      checked={penalties?.length > 0 && selectedPenalties.length === penalties.length}
                      className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#6636a3] checked:border-[#6636a3] accent-[#6636a3] focus:ring-2 focus:ring-[#6636a3] transition duration-150"
                    />
                  </TableHead>}

              </TableRow>
            </TableHeader>


            <TableBody>
              {paginatedPenalties?.length > 0 ? (
                paginatedPenalties.map((penalty) => (
                  <TableRow key={penalty._id} className="transition duration-200 hover:bg-[#1f1f2e] hover:shadow-inner border-none"
                  >
                    <TableCell className="min-w-[200px] py-4 px-3">
                      <div className="flex items-center gap-3 p-2 rounded-lg border border-[#6636a3]/30 bg-[#1c1b2d] shadow-sm">
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
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-[#6636a3]/50 bg-gray-300"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src =
                              "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                          }}
                        />
                        <div className="truncate max-w-[140px] sm:max-w-[180px]">
                          <span className="font-medium text-white">
                            {typeof penalty.userId === "object" && penalty.userId?.name
                              ? penalty.userId.name
                              : users?.find((u) =>
                                u._id ===
                                (typeof penalty.userId === "string" ? penalty.userId : penalty.userId?._id)
                              )?.name || "User"}
                          </span>
                        </div>
                      </div>
                    </TableCell>


                    <TableCell className="font-medium text-white min-w-[180px] py-4 px-10">
                      <span
                        className="py-1 rounded-full text-xs font-medium text-[#9f5bf7]"
                      >
                        {formatPenaltyType(penalty.type)}
                      </span>
                    </TableCell>


                    <TableCell className="font-semibold text-red-600 py-4 px-3">₹{penalty.amount.toFixed(2)}</TableCell>


                    <TableCell className="align-middle text-gray-300 py-4 px-3">
                      <div className="flex justify-start items-center gap-2 group/tooltip relative w-auto max-w-[180px]">
                        <Tooltip
                          delayDuration={0}
                          disableHoverableContent
                          closeDelay={200}
                          supportMobileTap={true}
                        >
                          <TooltipTrigger asChild>
                            <button className="w-full cursor-pointer flex items-center gap-1 hover:text-[#9f5bf7] transition-colors relative bg-transparent border-0 p-0 text-left">
                              <span className="inline-block overflow-hidden text-ellipsis whitespace-nowrap w-full text-left">
                                {penalty.description.length > 18
                                  ? penalty.description.slice(0, 18) + '...'
                                  : penalty.description}
                              </span>
                            </button>
                          </TooltipTrigger>

                          <TooltipContent
                            side="bottom"
                            align="start"
                            sideOffset={5}
                            className="bg-[#1f1f2e] border border-[#6636a3] px-3 py-2 max-w-[200px] sm:max-w-[300px] break-words shadow-lg animate-in fade-in-0 zoom-in-95 z-50 pointer-events-auto"
                          >
                            <p className="text-sm text-white whitespace-normal">
                              {penalty.description}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>




                    <TableCell className="min-w-[160px] text-gray-400 py-4 px-3">
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(penalty.createdAt))}
                    </TableCell>



                    {isAdmin && (
                      <TableCell className="text-center py-4 px-3">

                        <EditPenaltyDialog penalty={penalty} />

                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell className="text-center py-4 px-3">
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectPenalty(penalty._id, e.target.checked)}
                          checked={selectedPenalties.includes(penalty._id)}
                          className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#6636a3] checked:border-[#6636a3] accent-[#6636a3] focus:ring-2 focus:ring-[#6636a3] transition duration-150"
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-[#1c1b2d] p-6 rounded-full">
                        <FaClipboardList className="w-12 h-12 text-[#6636a3]" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-white mb-2">No Penalties Found</h3>
                        <p className="text-gray-400 max-w-sm">
                          There are currently no penalties recorded. New penalties will appear here when added.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>


          </Table>

          { /* Pagination Component - Only shown when there are penalties */}
          {penalties?.length > 0 && totalPages > 1 && (
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



      {/* Mobile Navigation */}
      <div className="block md:hidden">
        <MobileNav />
      </div>
    </TooltipProvider>

  );
}

/* Add this at the top of your file */
const globalStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(102, 54, 163, 0.5);
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(102, 54, 163, 0.7);
  }

  @keyframes blob {
    0% {
      transform: translate(0px, 0px) scale(1);
    }
    33% {
      transform: translate(30px, -50px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
    100% {
      transform: translate(0px, 0px) scale(1);
    }
  }
`;