import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { showSuccess, showError, showWarning } from "@/services/toastService";
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
import { FaUserCircle, FaEdit, FaTrash, FaClipboardList, FaSearch, FaUsers } from "react-icons/fa";
import { BsThreeDots } from "react-icons/bs";
import { Settings, Plus } from "lucide-react";
import { MdOutlineDateRange, MdAccessTime, MdAttachMoney, MdTimer, MdTimerOff, MdCalendarToday, MdGroup, MdPersonAdd, MdCheck } from "react-icons/md";
import { apiRequest } from "@/lib/queryClient";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MobileNav } from "@/components/mobile-nav";
import { CustomPagination } from "@/components/custom-pagination";

// Interfaces
interface PenaltySettings {
  contributionPenaltyPercentage: number;
  warningPeriodDays: number;
  selectedUsers: string[];
}

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

// Helper function to format penalty type
const formatPenaltyType = (type: PenaltyType): string => {
  switch (type) {
    case PenaltyType.LATE_PAYMENT:
      return "Late Payment";
    case PenaltyType.DAMAGE:
      return "Damage";
    case PenaltyType.RULE_VIOLATION:
      return "Rule Violation";
    case PenaltyType.OTHER:
      return "Other";
    default:
      return type;
  }
};

// Shared timer hook for consistency between desktop and mobile
function usePenaltyTimer() {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [timeComponents, setTimeComponents] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
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
          setTimeComponents({ days, hours, minutes, seconds });
        } else {
          setTimeRemaining("Penalty Due");
          setTimeComponents({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [timerData]);

  return { timeRemaining, timeComponents, timerData };
}

// Penalty Timer Component (Desktop)
function PenaltyTimer() {
  const { timeRemaining, timerData } = usePenaltyTimer();

  if (!timerData) return null;

  return (
    <div className="relative group">
      {/* Animated gradient border with glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#582c84] via-purple-500 to-[#582c84] rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-500 animate-gradient-x"></div>

      {/* Main content with glass effect */}
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 bg-black/50 backdrop-blur-lg rounded-lg border border-white/10 shadow-xl transition-all duration-300 group-hover:bg-black/60 group-hover:scale-[1.02] w-full">
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* Icon background with pulse effect */}
            <div className="absolute -inset-0.5 bg-[#582c84] rounded-full blur opacity-50 group-hover:opacity-75 transition duration-300"></div>
            <div className="relative p-2.5 bg-[#582c84]/20 rounded-full border border-[#582c84]/30 group-hover:bg-[#582c84]/30 transition duration-300">
              <MdAccessTime className="text-xl text-[#582c84] group-hover:scale-110 transform transition duration-300" />
            </div>
          </div>
          <span className="font-medium text-sm text-white/90 tracking-wide">Next Penalty In:</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-sm font-mono font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-[#582c84]/20 to-purple-500/20 border border-[#582c84]/30 text-white/90 shadow-inner">
            {timeRemaining}
          </span>
        </div>
      </div>

    </div>
  );
}

// Penalty Settings Form Component
export function PenaltySettingsForm() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [penaltyPercentage, setPenaltyPercentage] = useState<number>(3);
  const [warningDays, setWarningDays] = useState<number>(3);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Helper function to get initials from name
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    // Split by spaces and filter out empty strings
    const words = name.split(" ").filter(word => word.length > 0);
    // Get the first letter of each word and convert to uppercase, handle undefined safely
    const initials = words.map(word => (word[0] || "").toUpperCase());
    // Return all initials, no limit
    return initials.join("") || "U";
  };

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
    }, onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/penalty-settings"] });
      showSuccess("Penalty settings have been updated successfully.");
    },
    onError: () => {
      showError("Failed to update settings. Please try again.");
    },
    onSettled: () => setLoading(false),
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#582c84] border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#151525] p-4 sm:p-6 rounded-lg">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-[#582c84]/20 rounded-full mix-blend-multiply filter blur opacity-70 animate-[blob_7s_infinite]"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[blob_7s_infinite_2s]"></div>
      <div className="absolute -bottom-8 left-20 w-32 h-32 bg-[#582c84]/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[blob_7s_infinite_4s]"></div>



      <form onSubmit={handleSubmit} className="relative space-y-6 overflow-hidden">

        {/* Title */}
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-2xl font-bold text-white">Penalty Configuration</h2>
          <p className="text-sm text-gray-400">Configure penalty settings for your flat members</p>
        </div>

        {/* Penalty Percentage */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#582c84] via-purple-500 to-[#582c84] rounded-xl blur opacity-60 group-hover:opacity-75 transition duration-300"></div>

          <div className="relative backdrop-blur-md bg-black/40 p-6 rounded-xl border border-[#582c84]/30 hover:bg-black/50">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#582c84] rounded-full blur opacity-50"></div>
                  <div className="relative p-2.5 bg-[#582c84]/20 rounded-full border border-[#582c84]/30">
                    <MdAttachMoney className="text-xl text-[#582c84]" />
                  </div>
                </div>
                <Label htmlFor="penaltyPercentage" className="text-lg font-semibold text-white">Penalty Percentage</Label>
              </div>
              <span className="text-lg font-bold text-white px-4 py-1.5 rounded-full bg-[#582c84]/30 border border-[#582c84]/50">{penaltyPercentage}%</span>
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#582c84] via-purple-500 to-[#582c84] rounded-xl blur opacity-60 group-hover:opacity-75 transition duration-300"></div>


          <div className="relative backdrop-blur-md bg-black/40 p-4 sm:p-6 rounded-xl border border-[#582c84]/30 hover:bg-black/50 transition-all duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#582c84] rounded-full blur opacity-50"></div>
                  <div className="relative p-2.5 bg-[#582c84]/20 rounded-full border border-[#582c84]/30">
                    <MdTimerOff className="text-xl text-[#582c84]" />
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

              <div className="flex items-center gap-2 bg-[#582c84]/10 p-1 rounded-lg border border-[#582c84]/20 w-full sm:w-auto">
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg">
                  <MdCalendarToday className="text-[#582c84] flex-shrink-0" />
                  <span className="text-white/80 hidden sm:inline">Days:</span>
                </span>
                <span className="text-lg font-bold text-white px-4 py-1.5 rounded-lg bg-[#582c84]/30 border border-[#582c84]/50 flex-grow text-center sm:text-left sm:flex-grow-0">
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#582c84] via-purple-500 to-[#582c84] rounded-xl blur opacity-60 group-hover:opacity-75 transition duration-300"></div>

          <div className="relative backdrop-blur-md bg-black/40 p-6 rounded-xl border border-[#582c84]/30 hover:bg-black/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#582c84] rounded-full blur opacity-50"></div>
                  <div className="relative p-2.5 bg-[#582c84]/20 rounded-full border border-[#582c84]/30">
                    <MdGroup className="text-xl text-[#582c84]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-white">Select Users</Label>
                  <p className="text-sm text-gray-400">Choose users for penalty application</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-[#582c84]/10 px-3 py-1.5 rounded-lg border border-[#582c84]/20">
                <MdPersonAdd className="text-[#582c84]" />
                <span className="text-white/80 text-sm">{selectedUsers.length} Selected</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-1 sm:pr-2">
              {users?.map((user) => (
                <div
                  key={user._id}
                  className={`group/card relative flex items-center gap-3 flex-wrap sm:flex-nowrap p-4 rounded-xl w-full transition-all duration-300 ${selectedUsers.includes(user._id)
                    ? 'bg-[#582c84]/20 border-[#582c84]/50 shadow-lg'
                    : 'bg-black/30 hover:bg-black/40 hover:shadow-lg'
                    } border border-[#582c84]/30`}
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
                      <div className=" w-12 h-12 rounded-xl overflow-hidden transition-transform duration-300 group-hover/card:scale-105 ">
                        <Avatar className="w-full h-full border-2 border-[#ffff]/30 bg-[#1c1b2d] shadow-sm">
                          <AvatarImage
                            src={user?.profilePicture}
                            alt={user?.name || "User"}
                            className="object-cover  "
                          />
                          <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                            {getInitials(user?.name || "")}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {selectedUsers.includes(user._id) && (
                        <div className="absolute -bottom-1 -right-1 bg-[#582c84] rounded-lg w-5 h-5 border-2 border-black flex items-center justify-center shadow-lg">
                          <MdCheck className="text-white text-sm" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 break-words whitespace-normal">{user.email}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${selectedUsers.includes(user._id)
                      ? 'bg-[#582c84] border-[#582c84]'
                      : 'border-[#582c84]/30 group-hover/card:border-[#582c84]/50'
                      }`}>
                      <MdCheck className={`text-lg transition-all duration-300 ${selectedUsers.includes(user._id)
                        ? 'text-white scale-100'
                        : 'text-[#582c84]/30 scale-75'
                        }`} />
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#582c84]/20">
              <p className="text-xs text-gray-400 italic">
                Leave unselected to apply penalties to all users
              </p>
              <div className="sm:hidden flex items-center space-x-2 bg-[#582c84]/10 px-3 py-1.5 rounded-lg border border-[#582c84]/20">
                <MdPersonAdd className="text-[#582c84]" />
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
            : 'bg-[#582c84] hover:bg-[#542d87] hover:-translate-y-0.5'
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
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const handleDelete = () => {
    showLoader();
    fetch(`/api/penalties/${penalty._id}`, {
      method: "DELETE",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
      showSuccess("Penalty has been deleted successfully.");
      setDeleteDialogOpen(false);
      hideLoader();
    })
      .catch((error) => {
        console.error("Delete error:", error);
        showError("Failed to delete penalty. Please try again.");
        hideLoader();
      });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center space-x-2">
          <DialogTrigger asChild>
            {/* Edit Button with Icon */}
            <button
              className="p-1.5 text-[#582c84] hover:bg-white/5 rounded-full transition-all duration-200"
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

        <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Edit Penalty</DialogTitle>
          </DialogHeader>          <form
            onSubmit={(e) => {
              e.preventDefault();
              showLoader();
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
                }).then((data) => {
                  queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
                  showSuccess("Penalty has been updated successfully.");
                  setOpen(false); // Close the dialog on success
                  hideLoader();
                })
                .catch((error) => {
                  console.error("Update error:", error);
                  showError("Failed to update penalty. Please try again.");
                  hideLoader();
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
                <SelectContent className="bg-[#151525] border border-[#582c84]/30">
                  <SelectItem value="LATE_PAYMENT" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-white focus:bg-[#582c84]/30 cursor-pointer">Late Payment</SelectItem>
                  <SelectItem value="DAMAGE" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-white focus:bg-[#582c84]/30 cursor-pointer">Damage</SelectItem>
                  <SelectItem value="RULE_VIOLATION" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-white focus:bg-[#582c84]/30 cursor-pointer">Rule Violation</SelectItem>
                  <SelectItem value="OTHER" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-white focus:bg-[#582c84]/30 cursor-pointer">Other</SelectItem>
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
                className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white/90">Description</Label>
              <Textarea
                name="description"
                defaultValue={penalty.description}
                placeholder="Description"
                className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
              />
            </div>

            <Button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg shadow-md transition"
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
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPenalty, setNewPenalty] = useState<{
    userId: string;
    type: PenaltyType;
    amount: string;
    description: string;
    image: string;
  }>({
    userId: "",
    type: PenaltyType.LATE_PAYMENT,
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

  // Use shared timer hook instead of hardcoded logic
  const { timeComponents } = usePenaltyTimer();

  // Show loader when the component mounts and set up cleanup
  useEffect(() => {
    showLoader();

    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);
  const { data: penalties = [], isLoading: penaltiesLoading } = useQuery<Penalty[]>({
    queryKey: ["/api/penalties"]
  });

  const { data: totals, isLoading: totalsLoading } = useQuery<{ userTotal: number; flatTotal: number }>({
    queryKey: ["/api/penalties/total"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Manage loading state based on query states
  useEffect(() => {
    const isLoading = penaltiesLoading || totalsLoading || usersLoading;

    // Update dataLoading based on query states
    setDataLoading(isLoading);

    // Hide loader when all queries are done
    if (!isLoading) {
      hideLoader();
    }
  }, [penaltiesLoading, totalsLoading, usersLoading]);
  // Users query is already defined above

  // Effect to reset selected penalties when search query is cleared or changed
  useEffect(() => {
    setSelectedPenalties([]);
  }, [searchQuery]);

  // Function to handle selecting/deselecting all penalties (filtered only)
  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredPenalties) {
      setSelectedPenalties(filteredPenalties.map(penalty => penalty._id));
    } else {
      setSelectedPenalties([]);
    }
  };

  // Function to handle selecting/deselecting a single penalty (filtered only)
  const handleSelectPenalty = (penaltyId: string, checked: boolean) => {
    if (checked) {
      if (filteredPenalties?.some((penalty) => penalty._id === penaltyId)) {
        setSelectedPenalties(prev => [...prev, penaltyId]);
      }
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
    showLoader();
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
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
        showSuccess(`${selectedPenalties.length} penalties have been deleted successfully.`);
        setSelectedPenalties([]);
        setBulkDeleteDialogOpen(false);
        hideLoader();
      })
      .catch((error) => {
        console.error("Bulk delete error:", error);
        showError("Failed to delete penalties. Please try again.");
        setBulkDeleteDialogOpen(false);
        hideLoader();
      });
  };

  // Format penalty type for display
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

  // Filter and paginate penalties
  const filteredPenalties = penalties.filter((penalty: Penalty) => {
    if (!searchQuery) return true;

    const searchText = searchQuery.toLowerCase();
    const penaltyDate = new Date(penalty.createdAt).toLocaleDateString();
    const userName = typeof penalty.userId === "object" && penalty.userId?.name ?
      penalty.userId.name :
      users?.find((u: User) => u._id === penalty.userId)?.name || "";

    return (
      // Search by username
      userName.toLowerCase().includes(searchText) ||
      // Search by type
      formatPenaltyType(penalty.type).toLowerCase().includes(searchText) ||
      // Search by amount
      penalty.amount.toString().includes(searchText) ||
      // Search by description
      penalty.description.toLowerCase().includes(searchText) ||
      // Search by date
      penaltyDate.toLowerCase().includes(searchText)
    );
  });

  // Update the pagination logic to handle undefined cases
  const totalPages = Math.ceil((filteredPenalties?.length || 0) / penaltiesPerPage);
  const paginatedPenalties = filteredPenalties?.slice(
    (currentPage - 1) * penaltiesPerPage,
    currentPage * penaltiesPerPage
  ) || [];

  const queryClient = useQueryClient();
  const addPenaltyMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      type: PenaltyType;
      amount: number;
      description: string;
      image?: string;
    }) => {
      showLoader();
      try {
        const res = await apiRequest("POST", "/api/penalties", data);
        return res.json();
      } catch (error) {
        console.error("Add penalty error:", error);
        hideLoader();
        throw error;
      }
    }, onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
      showSuccess("Penalty added successfully");
      setOpenAddDialog(false);
      setNewPenalty({
        userId: "",
        type: PenaltyType.LATE_PAYMENT,
        amount: "",
        description: "",
        image: "",
      });
      hideLoader();
    },
    onError: (error) => {
      console.error("Add penalty error:", error);
      showError("Failed to add penalty. Please try again.");
      hideLoader();
    },
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPenalty.userId || !newPenalty.amount || !newPenalty.description) {
      showError("Please fill in all required fields.");
      return;
    }

    addPenaltyMutation.mutate({
      userId: newPenalty.userId,
      type: newPenalty.type,
      amount: parseFloat(newPenalty.amount),
      description: newPenalty.description,
      image: newPenalty.image,
    });
  }; const getInitials = (name?: string | null) => {
    if (!name) return "U";
    // Split by spaces and filter out empty strings
    const words = name.split(" ").filter(word => word.length > 0);
    // Get the first letter of each word and convert to uppercase, handle undefined safely
    const initials = words.map(word => (word[0] || "").toUpperCase());
    // Return all initials, no limit
    return initials.join("") || "U";
  };

  return (
    <>
      <TooltipProvider>
        <Header />
        <div className="min-h-screen p-4 sm:p-8 pb-28 pt-24 sm:pt-36 bg-[#0f0f1f]">
        <div className="max-w-7xl mx-auto">
          <div className="relative group mb-8">
            {/* Blurred border layer */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>

            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-white/10 flex flex-wrap justify-between items-center gap-4 mb-6 sm:mb-8 mt-8">
              <h1 className="text-xl sm:text-2xl md:text-3xl text-white font-bold">Penalties</h1>

              {/* Desktop buttons only */}
              <div className="hidden sm:flex gap-2 w-auto">
                {/* Settings Button */}
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 bg-white/80 hover:bg-white/90 text-gray-700 flex-1 sm:flex-none justify-center">
                        <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-sm sm:text-base">Settings</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent
                      aria-describedby="penalty-settings-description"
                      className="max-w-3xl w-full m-0 sm:mx-0  p-0 rounded-lg border-[#582c84]/30 shadow-2xl bg-[#151525] sm:rounded-lg overflow-hidden"
                    >

                      <DialogHeader className="px-6 pt-6 pb-2 border-b border-[#582c84]/30">
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
                    <Button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#582c84] text-white rounded-lg shadow-md transition hover:bg-[#542d87] flex-1 sm:flex-none justify-center">
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base">Add Penalty</span>
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
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
                          <SelectTrigger className="border border-white/10 bg-[#151525] text-white focus:ring-2 focus:ring-[#582c84] outline-none transition">
                            {/* Lighter placeholder text */}
                            <SelectValue
                              placeholder="Select a user"
                              className="text-white/80"
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-[#151525] border border-[#582c84]/30">
                            {users?.map((user: any) => (
                              <SelectItem
                                key={user._id}
                                value={user._id}
                                className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer"
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
                          <SelectTrigger className="border border-white/10 bg-[#151525] text-white focus:ring-2 focus:ring-[#582c84] outline-none transition">
                            <SelectValue placeholder="Select penalty type" className="text-white/80" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#151525] border border-[#582c84]/30">
                            <SelectItem value="LATE_PAYMENT" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Late Payment</SelectItem>
                            <SelectItem value="DAMAGE" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Damage</SelectItem>
                            <SelectItem value="RULE_VIOLATION" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Rule Violation</SelectItem>
                            <SelectItem value="OTHER" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Other</SelectItem>
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
                          className="w-full px-4 py-2 border border-white/10 bg-[#151525] text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                        />
                      </div>

                      {/* Description Textarea */}
                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-white/90">Description</Label>
                        <Textarea
                          placeholder="Description"
                          value={newPenalty.description}
                          onChange={(e) => setNewPenalty({ ...newPenalty, description: e.target.value })}
                          className="w-full px-4 py-2 border border-white/10 bg-[#151525] text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                        />
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        disabled={addPenaltyMutation.isPending}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg shadow-md transition"
                      >
                        <span>Add Penalty</span>
                      </Button>
                    </form>

                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Desktop Cards */}
          <div className="hidden md:grid gap-6 grid-cols-1 lg:grid-cols-2 mb-8">
            <Card className="bg-[#582c84] text-white shadow-xl border border-white/10 rounded-lg">
              <div
                className="w-full overflow-x-auto px-4 py-4 bg-transparent rounded-t-lg [&::-webkit-scrollbar]:hidden"
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
                          (users?.find(u => u._id === userId)?.name) || "User"; const userProfile = (typeof userPenalties[0]?.userId === 'object' && userPenalties[0]?.userId?.profilePicture) ||
                            users?.find(u => u._id === userId)?.profilePicture;

                        // Fix progressPercentage type issues
                        const progressPercentage = parseInt(Math.min((totalUserAmount / totalPenaltiesGlobal) * 100, 100).toFixed(0));                        const getBorderColor = (progressPercentage: number): string => {
                          if (progressPercentage >= 70) return "#FF4500"; // Red for high penalties (>70%)
                          if (progressPercentage >= 40) return "#FFD700"; // Yellow for medium penalties (40-70%)
                          return "#4CAF50"; // Green for low penalties (<40%)
                        };

                        const radius = 28; // Radius for positioning text
                        const angleRad = ((progressPercentage / 100) * 360 - 90) * (Math.PI / 180);
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
                                  background: `conic-gradient(${getBorderColor(progressPercentage)} ${progressPercentage}%, rgba(255, 255, 255, 0.1) ${progressPercentage}%)`,
                                  padding: "3px",
                                  borderRadius: "50%",
                                }}
                              >
                                {/* Profile Image */}                                <Avatar className="w-full h-full">
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
                                  color: getBorderColor(progressPercentage),
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
                    <div className="w-full flex items-center justify-center py-6 px-4 min-h-[120px]">
                      <div className="flex flex-col items-center justify-center">
                        {/* Icon container with theme colors */}
                        <div className="w-12 h-12 bg-gradient-to-br from-[#582c84] to-[#8e4be4] rounded-full flex items-center justify-center mb-3 shadow-lg">
                          <FaClipboardList className="w-6 h-6 text-white" />
                        </div>
                        
                        {/* Main message */}
                        <p className="text-white/80 text-sm font-medium text-center">
                          No penalties found
                        </p>
                        
                        {/* Subtitle */}
                        <p className="text-white/50 text-xs text-center mt-1">
                          All members are following the rules
                        </p>
                      </div>
                    </div>
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

            <Card className="bg-[#582c84] text-white shadow-xl border border-white/10 rounded-lg p-4">
              {/* Header with Profile & Date-Time */}
              <div className="flex justify-between items-center border-b border-white/10 pb-3 flex-wrap gap-3 sm:gap-0">
                {/* Left Side: User Profile */}
                <div className="flex items-center space-x-3">                  <Avatar className="w-12 h-12 border border-white/20 shadow-lg transition-transform duration-300 hover:scale-105">
                  <AvatarImage
                    src={user?.profilePicture}
                    alt="User Profile"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
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
                          ? (typeof p.userId === 'object' ? p.userId._id : p.userId)
                          : p.userId;

                        const userIdStr = penaltyUserId?.toString();
                        const currentUserIdStr = user?._id?.toString();

                        return userIdStr === currentUserIdStr;
                      }).length || 0} Penalties
                    </div>
                  </div>
                </div>

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

          {/* Mobile View - Completely Different Design */}
          <div className="md:hidden mb-8 space-y-4">
            {/* Mobile Overall Penalties Card with Timer */}
            <div className="relative overflow-hidden">
              {/* Theme matching gradient background */}
              {/* <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f1f] via-[#1a1a2e] to-[#151525] opacity-95"></div>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div> */}
              
              <div className="relative p-5 rounded-2xl border border-[#582c84]/30 backdrop-blur-sm bg-black/20">
                {/* Header with icon and title */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-[#582c84]/20 rounded-full backdrop-blur-sm border border-[#582c84]/30">
                      <FaClipboardList className="w-5 h-5 text-[#ab6cff]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Flat Penalties</h2>
                      <p className="text-white/70 text-xs">Overall Statistics</p>
                    </div>
                  </div>
                  
                  {/* Floating total amount badge */}
                  <div className="bg-[#582c84]/20 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#582c84]/40">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#ab6cff]">
                        ₹{penalties && Array.isArray(penalties) && penalties.length > 0
                          ? penalties.reduce((sum, penalty) => sum + (penalty.amount || 0), 0).toFixed(2)
                          : "0.00"}
                      </div>
                      <div className="text-[10px] text-white/70">Total</div>
                    </div>
                  </div>
                </div>

                {/* Mobile Action Buttons */}
                <div className="flex gap-3 mb-6">
                  {/* Settings Button - Icon Only */}
                  {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-[#ab6cff] border border-white/10 hover:border-[#ab6cff]/30 backdrop-blur-sm transition-all duration-300 rounded-lg"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent
                        aria-describedby="penalty-settings-description"
                        className="max-w-3xl w-full m-0 sm:mx-0  p-0 rounded-lg border-[#582c84]/30 shadow-2xl bg-[#151525] sm:rounded-lg overflow-hidden"
                      >

                        <DialogHeader className="px-6 pt-6 pb-2 border-b border-[#582c84]/30">
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
                      <Button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#582c84] to-[#ab6cff] hover:from-[#542d87] hover:to-[#9f5bf7] text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex-1 justify-center text-sm font-medium backdrop-blur-sm border border-[#582c84]/30">
                        <Plus className="h-4 w-4" />
                        <span>Add Penalty</span>
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
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
                            <SelectTrigger className="border border-white/10 bg-[#151525] text-white focus:ring-2 focus:ring-[#582c84] outline-none transition">
                              {/* Lighter placeholder text */}
                              <SelectValue
                                placeholder="Select a user"
                                className="text-white/80"
                              />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151525] border border-[#582c84]/30">
                              {users?.map((user) => (
                                <SelectItem
                                  key={user._id}
                                  value={user._id}
                                  className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer"
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
                            <SelectTrigger className="border border-white/10 bg-[#151525] text-white focus:ring-2 focus:ring-[#582c84] outline-none transition">
                              <SelectValue placeholder="Select penalty type" className="text-white/80" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#151525] border border-[#582c84]/30">
                              <SelectItem value="LATE_PAYMENT" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Late Payment</SelectItem>
                              <SelectItem value="DAMAGE" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Damage</SelectItem>
                              <SelectItem value="RULE_VIOLATION" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Rule Violation</SelectItem>
                              <SelectItem value="OTHER" className="text-white hover:bg-[#582c84]/30 hover:text-white focus:text-text-white focus:bg-[#582c84]/30 cursor-pointer">Other</SelectItem>
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
                            className="w-full px-4 py-2 border border-white/10 bg-[#151525] text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                          />
                        </div>

                        {/* Description Textarea */}
                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-white/90">Description</Label>
                          <Textarea
                            placeholder="Description"
                            value={newPenalty.description}
                            onChange={(e) => setNewPenalty({ ...newPenalty, description: e.target.value })}
                            className="w-full px-4 py-2 border border-white/10 bg-[#151525] text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                          />
                        </div>

                        {/* Submit Button */}
                        <Button
                          type="submit"
                          disabled={addPenaltyMutation.isPending}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg shadow-md transition"
                        >
                          <span>Add Penalty</span>
                        </Button>
                      </form>

                    </DialogContent>
                  </Dialog>
                </div>

                {/* Penalty Timer - Compact Premium Design */}
                {timeComponents && (
                  <div className="flex items-center justify-center gap-3 bg-gradient-to-r from-[#582c84]/20 to-[#ab6cff]/20 backdrop-blur-sm rounded-lg p-3 border border-[#582c84]/30 mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#582c84] to-[#ab6cff] rounded-full flex items-center justify-center shadow-lg">
                        <MdTimer className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">Next Penalty</div>
                        <div className="text-[#ab6cff] text-xs font-medium">
                          {timeComponents.days > 0 ? 
                            `Auto-check in ${timeComponents.days}d ${timeComponents.hours}h ${timeComponents.minutes}m ${timeComponents.seconds}s` :
                            `Auto-check in ${timeComponents.hours}h ${timeComponents.minutes}m ${timeComponents.seconds}s`
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* User breakdown with progress */}
                {penalties && Array.isArray(penalties) && penalties.length > 0 ? (
                  <div>
                    <h3 className="text-white font-semibold mb-4 flex items-center text-sm">
                      <FaUsers className="mr-2 text-[#ab6cff]" />
                      Member Penalties
                    </h3>
                    {/* Horizontal scrollable container - Shows 2-3 cards at a time */}
                    <div 
                      className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden" 
                      style={{ 
                        scrollbarWidth: "none", 
                        msOverflowStyle: "none" 
                      }}
                    >
                      <div className="flex space-x-3 min-w-max px-1">
                        {(() => {
                          const totalPenaltiesGlobal = penalties.reduce((sum, penalty) => sum + (penalty.amount || 0), 0) || 1;
                          
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
                              users?.find(u => u._id === userId)?.profilePicture;
                            const progressPercentage = Math.min((totalUserAmount / totalPenaltiesGlobal) * 100, 100);

                            return (
                              <div key={userId} className="flex-shrink-0 bg-[#151525]/50 backdrop-blur-sm rounded-xl p-4 border border-[#582c84]/20 min-w-[200px] w-[200px] sm:min-w-[300px] sm:w-[300px]">
                                {/* User Header with Avatar */}
                                <div className="flex items-center space-x-3 mb-4">
                                  <div className="relative flex-shrink-0">
                                    <Avatar className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-[#582c84]/30">
                                      <AvatarImage src={userProfile} alt={userName} className="object-cover" />
                                      <AvatarFallback className="bg-[#1a1a2e] text-white text-sm">
                                        {getInitials(userName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {/* Progress ring overlay */}
                                    <div 
                                      className="absolute inset-0 rounded-full" 
                                      style={{
                                        background: `conic-gradient(#ab6cff ${progressPercentage}%, rgba(255, 255, 255, 0.1) ${progressPercentage}%)`,
                                        padding: "2px",
                                        mask: "radial-gradient(circle at center, transparent 70%, black 72%)"
                                      }}
                                    ></div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-white font-semibold text-sm sm:text-base" title={userName}>
                                      {userName}
                                    </div>
                                    <div className="text-white/60 text-xs sm:text-sm">
                                      {userPenalties.length} penalty{userPenalties.length !== 1 ? 'ies' : 'y'}
                                    </div>
                                  </div>
                                </div>

                                {/* Stats Row */}
                                <div className="flex justify-between items-center">
                                  <div className="text-left">
                                    <div className="text-white/70 text-xs">Total Amount</div>
                                    <div className="text-red-400 font-bold text-lg sm:text-xl">₹{totalUserAmount.toFixed(2)}</div>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    {/* Circular Progress */}
                                    <div className="relative w-12 h-12">
                                      {(() => {
                                        // Dynamic color based on percentage
                                        const getProgressColor = (percentage: number) => {
                                          if (percentage >= 70) return "#FF4500"; // Red for high penalties (>70%)
                                          if (percentage >= 40) return "#FFD700"; // Yellow for medium penalties (40-70%)
                                          return "#8b5cf6"; // Lighter theme color for low penalties (<40%)
                                        };
                                        const progressColor = getProgressColor(progressPercentage);
                                        
                                        return (
                                          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                                            {/* Background circle */}
                                            <path
                                              className="text-white/10"
                                              stroke="currentColor"
                                              strokeWidth="3"
                                              fill="transparent"
                                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                            {/* Progress circle with dynamic color */}
                                            <path
                                              stroke={progressColor}
                                              strokeWidth="3"
                                              strokeLinecap="round"
                                              fill="transparent"
                                              strokeDasharray={`${progressPercentage}, 100`}
                                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                          </svg>
                                        );
                                      })()}
                                      {/* Percentage text in center with dynamic color */}
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span 
                                          className="text-xs font-bold"
                                          style={{ 
                                            color: (() => {
                                              if (progressPercentage >= 70) return "#FF4500";
                                              if (progressPercentage >= 40) return "#FFD700";
                                              return "#8b5cf6";
                                            })()
                                          }}
                                        >
                                          {progressPercentage.toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-[#582c84]/10 rounded-full p-6 w-20 h-20 flex items-center justify-center mx-auto mb-4">
                      <FaClipboardList className="w-8 h-8 text-[#ab6cff]" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">No Penalties</h3>
                    <p className="text-white/60 text-sm">All members are following the rules perfectly!</p>
                  </div>
                )}
              </div>
            </div>
          </div>  



          {/* Search and Actions */}
          <div className="mb-4 space-y-4 md:space-y-0 md:flex md:justify-between md:items-center gap-4">
            {/* Mobile Search - Full width */}
            <div className="relative flex-1 max-w-xl">
              <Input
                type="text"
                placeholder="Search penalties by user, type, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#151525] border-[#582c84]/30 text-white placeholder:text-white/50 pl-10 py-6 rounded-xl shadow-md focus:ring-2 focus:ring-[#582c84] transition-all duration-200"
              />
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-lg" />
            </div>

            {/* Bulk Delete Button */}
            {selectedPenalties.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
              >
                <FaTrash className="text-sm" />
                Delete Selected ({selectedPenalties.length})
              </Button>
            )}
          </div>

          {/* Table Container with proper scroll behavior */}
          <div className="bg-[#151525] rounded-xl overflow-hidden shadow-lg">
            {/* Only show empty state when no data, not wrapped in scrollable table */}
            {paginatedPenalties?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="flex flex-col items-center gap-6">
                  {/* Enhanced empty state design */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-[#582c84] to-[#ab6cff] p-8 rounded-full shadow-2xl">
                      <FaClipboardList className="w-16 h-16 text-white" />
                    </div>
                   
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-3">No Penalties Found</h3>
                    <p className="text-white/70 max-w-sm mx-auto leading-relaxed">
                      {searchQuery 
                        ? "No penalties match your search criteria. Try adjusting your search terms."
                        : "Great news! There are currently no penalties recorded. Keep up the good work!"
                      }
                    </p>
                    {searchQuery && (
                      <Button
                        onClick={() => setSearchQuery("")}
                        className="mt-4 bg-[#582c84] hover:bg-[#542d87] text-white px-6 py-2 rounded-lg"
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile Table View - Same as Desktop */}
                <div className="md:hidden overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  <Table className="w-full min-w-[800px]">
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
                        <TableHead className="w-10 text-center text-indigo-200/80 font-semibold py-3 border-[#582c84]">
                          <input
                            type="checkbox"
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            checked={filteredPenalties?.length > 0 && selectedPenalties.length === filteredPenalties.length && selectedPenalties.every(id => filteredPenalties.some(penalty => penalty._id === id))}
                            className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150"
                          />
                        </TableHead>}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedPenalties.map((penalty) => (
                      <TableRow key={penalty._id} className="transition-all duration-300 hover:bg-gradient-to-r hover:from-[#1f1f2e] hover:to-[#252540] hover:shadow-lg hover:shadow-[#582c84]/10 border-none group"
                      >
                        <TableCell className="min-w-[200px] py-4 px-3">
                          <div className="flex items-center gap-3 p-2 rounded-lg border border-[#582c84]/30 bg-[#1c1b2d] shadow-sm group-hover:border-[#582c84]/50 group-hover:bg-[#1e1d30] transition-all duration-300">
                            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#582c84]/50">
                              <AvatarImage
                                src={
                                  typeof penalty.userId === "object" && penalty.userId?.profilePicture
                                    ? penalty.userId.profilePicture
                                    : users?.find((u) =>
                                      u._id ===
                                      (typeof penalty.userId === "string" ? penalty.userId : penalty.userId?._id)
                                    )?.profilePicture
                                }
                                alt="User"
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                                {getInitials(
                                  typeof penalty.userId === "object" && penalty.userId?.name
                                    ? penalty.userId.name
                                    : users?.find((u) =>
                                      u._id ===
                                      (typeof penalty.userId === "string" ? penalty.userId : penalty.userId?._id)
                                    )?.name || "User"
                                )}
                              </AvatarFallback>
                            </Avatar>

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
                              supportMobileTap={true}
                            >
                              <TooltipTrigger asChild>
                                <button className="w-full cursor-pointer flex items-center gap-1 hover:text-[#9f5bf7] group-hover:text-[#b366ff] transition-all duration-300 relative bg-transparent border-0 p-0 text-left">
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
                                className="bg-[#1f1f2e] border border-[#582c84] px-3 py-2 max-w-[200px] sm:max-w-[300px] break-words shadow-lg animate-in fade-in-0 zoom-in-95 z-50 pointer-events-auto"
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
                              className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150"
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

                {/* Desktop Table View - Same table structure for both desktop and mobile */}
                <div className="hidden md:block overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  <Table className="w-full min-w-[800px]">
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
                        <TableHead className="w-10 text-center text-indigo-200/80 font-semibold py-3 border-[#582c84]">
                          <input
                            type="checkbox"
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            checked={filteredPenalties?.length > 0 && selectedPenalties.length === filteredPenalties.length && selectedPenalties.every(id => filteredPenalties.some(penalty => penalty._id === id))}
                            className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150"
                          />
                        </TableHead>}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedPenalties.map((penalty) => (
                      <TableRow key={penalty._id} className="transition-all duration-300 hover:bg-gradient-to-r hover:from-[#1f1f2e] hover:to-[#252540] hover:shadow-lg hover:shadow-[#582c84]/10 border-none group"
                      >
                        <TableCell className="min-w-[200px] py-4 px-3">
                          <div className="flex items-center gap-3 p-2 rounded-lg border border-[#582c84]/30 bg-[#1c1b2d] shadow-sm group-hover:border-[#582c84]/50 group-hover:bg-[#1e1d30] transition-all duration-300">
                            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#582c84]/50">
                              <AvatarImage
                                src={
                                  typeof penalty.userId === "object" && penalty.userId?.profilePicture
                                    ? penalty.userId.profilePicture
                                    : users?.find((u) =>
                                      u._id ===
                                      (typeof penalty.userId === "string" ? penalty.userId : penalty.userId?._id)
                                    )?.profilePicture
                                }
                                alt="User"
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                                {getInitials(
                                  typeof penalty.userId === "object" && penalty.userId?.name
                                    ? penalty.userId.name
                                    : users?.find((u) =>
                                      u._id ===
                                      (typeof penalty.userId === "string" ? penalty.userId : penalty.userId?._id)
                                    )?.name || "User"
                                )}
                              </AvatarFallback>
                            </Avatar>

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
                              supportMobileTap={true}
                            >
                              <TooltipTrigger asChild>
                                <button className="w-full cursor-pointer flex items-center gap-1 hover:text-[#9f5bf7] group-hover:text-[#b366ff] transition-all duration-300 relative bg-transparent border-0 p-0 text-left">
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
                                className="bg-[#1f1f2e] border border-[#582c84] px-3 py-2 max-w-[200px] sm:max-w-[300px] break-words shadow-lg animate-in fade-in-0 zoom-in-95 z-50 pointer-events-auto"
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
                              className="h-5 w-5 rounded-md bg-gray-300 border-gray-400 checked:bg-[#582c84] checked:border-[#582c84] accent-[#582c84] focus:ring-2 focus:ring-[#582c84] transition duration-150"
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </div>

          { /* Pagination Component - Only shown when there are penalties */}
          {penalties?.length > 0 && totalPages > 1 && (
          
                <CustomPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />  
            
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
    </>
  );
}