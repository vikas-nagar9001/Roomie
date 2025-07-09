import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { FiEdit2, FiSettings, FiLogOut, FiCamera, FiArrowLeft, FiMoon } from "react-icons/fi";
import { HiSpeakerphone } from "react-icons/hi";
import { MdOutlineCached } from "react-icons/md";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showSuccess, showError } from "@/services/toastService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";


export function MobileProfileHeader() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  

  // Fetch entries and payments data
  const { data: entries = [] } = useQuery<any[]>({
    queryKey: ["/api/entries"],
  });

  // Calculate user statistics
  const userEntries = entries?.filter((e) => {
    const entryUserId = typeof e.userId === 'object' && e.userId !== null
      ? (e.userId._id || e.userId.id || e.userId)
      : e.userId;
    const userIdStr = entryUserId?.toString();
    const currentUserIdStr = user?._id?.toString();
    return userIdStr === currentUserIdStr;
  }) || [];

  const pendingEntries = userEntries.filter(e => e.status === "PENDING");
  
  // Calculate amount only from approved entries
  const approvedAmount = userEntries
    .filter(entry => entry.status === "APPROVED")
    .reduce((sum, entry) => sum + (typeof entry.amount === 'number' ? entry.amount : 0), 0);

  // Get total penalties
  const [totalPenalties, setTotalPenalties] = useState(0);

  // Fetch penalties
  useEffect(() => {
    const fetchPenalties = async () => {
      try {
        const response = await fetch("/api/penalties");
        const data = await response.json();
        
        // Calculate user penalties
        const userPenalties = data.filter(penalty => {
          const penaltyUserId = typeof penalty.userId === 'object' ? penalty.userId._id : penalty.userId;
          return penaltyUserId?.toString() === user?._id?.toString();
        });
        
        const penaltyTotal = userPenalties.reduce((sum, penalty) => sum + (penalty.amount || 0), 0);
        setTotalPenalties(penaltyTotal);
      } catch (error) {
        console.error("Error fetching penalties:", error);
      }
    };
    
    if (user?._id) {
      fetchPenalties();
    }
  }, [user?._id]);

  // Final amount after subtracting penalties
  const totalAmount = approvedAmount - totalPenalties;

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      try {
        // Use the correct endpoint that exists on the server
        const res = await apiRequest("POST", "/api/set-version-new");
        
        // Check if the response is OK before trying to parse JSON
        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}: ${res.statusText}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Cache clear error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      showSuccess("Cache cleared successfully");
      
      // Clear the query cache
      queryClient.clear();
      
      // Add small timeout to ensure toast is seen before reload
      setTimeout(() => {
        window.location.reload();
      }, 800);
    },
    onError: (error: Error) => {
      showError("Failed to clear cache");
      console.error('Cache clear error details:', error.message);
    },
  });

  // Send announcement mutation
  const sendAnnouncementMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/send-flat-announcement", {
        message: message.trim()
      });
      
      if (!res.ok) {
        throw new Error(`Failed to send announcement: ${res.status}`);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      showSuccess("Announcement sent to all flat members!");
      setAnnouncementMessage("");
      setShowAnnouncementDialog(false);
      setShowMenu(false);
    },
    onError: (error: Error) => {
      showError("Failed to send announcement");
      console.error('Announcement error:', error.message);
    },
  });

  const handleSendAnnouncement = () => {
    if (!announcementMessage.trim()) {
      showError("Please enter an announcement message");
      return;
    }
    
    if (announcementMessage.trim().length < 5) {
      showError("Announcement must be at least 5 characters long");
      return;
    }
    
    sendAnnouncementMutation.mutate(announcementMessage);
  };
  const handleSignOut = async () => {
    try {
      await logoutMutation.mutateAsync();
      showSuccess("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      showError("Failed to log out");
    }
  };
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase();
  };

  // Add click outside handler to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      {/* Gradient Background */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#582c84] to-[#0f0f1f] z-0" />
      
      {/* Profile Content */}
      <div className="relative z-10 pt-6 pb-4 px-4 flex flex-col items-center">
        {/* Back Button */}
        <div className="absolute top-4 left-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full bg-gradient-to-r from-[#ab6cff] to-[#582c84] text-white hover:bg-gradient-to-r hover:from-[#c18fff] hover:to-[#7b4cc0] transition-all duration-300"
            onClick={() => navigate("/")}
          >
            <FiArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Settings Button */}
        <div className="absolute top-4 right-4 flex space-x-2">
          <Button 
            ref={buttonRef}
            variant="ghost" 
            size="sm" 
            className="rounded-full bg-gradient-to-r from-[#ab6cff] to-[#582c84] text-white hover:bg-gradient-to-r hover:from-[#c18fff] hover:to-[#7b4cc0] transition-all duration-300"
            onClick={() => setShowMenu(!showMenu)}
          >
            <FiSettings className="h-4 w-4" />
          </Button>
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <div 
            ref={menuRef}
            className="absolute top-14 right-8 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl  z-50 w-40 animate-in fade-in slide-in-from-top-5 duration-300"
          >
            {/* Show Announcement option only for admins */}
            {user?.role === "ADMIN" && (
              <Button 
                variant="ghost" 
                className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2 mb-1"
                onClick={() => {
                  setShowMenu(false);
                  setShowAnnouncementDialog(true);
                }}
              >
                <HiSpeakerphone className="mr-1 h-4 w-4" />
                Announcement
              </Button>
            )}
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2 mb-1"
              onClick={() => {
                setShowMenu(false);
                clearCacheMutation.mutate();
              }}
              disabled={clearCacheMutation.isPending}
            >
              <MdOutlineCached className="mr-1 h-4 w-4" />
              {clearCacheMutation.isPending ? "Clearing..." : "Clear Cache"}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2"
              onClick={() => {
                setShowMenu(false);
                handleSignOut();
              }}
              disabled={logoutMutation.isPending}
            >
              <FiLogOut className="mr-1 h-4 w-4" />
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        )}

        {/* Avatar */}
        <div className="mb-4 p-1 rounded-full bg-gradient-to-r from-[#ab6cff] to-[#582c84] shadow-xl relative group">
          <Avatar className="h-24 w-24 border-4 border-[#0f0f1f]/50">
            <AvatarImage src={user?.profilePicture} alt={user?.name || "User"} />
            <AvatarFallback className="bg-[#1a1a2e] text-white text-2xl">
              {getInitials(user?.name)}
            </AvatarFallback> 
          </Avatar>
          
          {/* Pencil Icon Overlay */}
          <div
            onClick={() => document.getElementById("profile-picture")?.click()}
            className="absolute bottom-0 right-0 p-2 bg-gradient-to-r from-[#ab6cff] to-[#582c84] text-white rounded-full cursor-pointer 
                     hover:bg-gradient-to-r hover:from-[#c18fff] hover:to-[#7b4cc0] transform hover:scale-105 transition-all shadow-lg"
          >
            <FiEdit2 className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* User Info */}
        <h2 className="text-xl font-bold text-white mb-1">{user?.name || "User"}</h2>
        <p className="text-white/70 text-sm mb-2">{user?.email || "No email"}</p>
        <div className="mb-4">
          <span className="inline-block px-3 py-1 bg-gradient-to-r from-[#ab6cff]/20 to-[#582c84]/20 border border-[#ab6cff]/30 rounded-full text-xs text-white/90 font-medium uppercase tracking-wider">
            {user?.role || "USER"}
          </span>
        </div>        {/* Stats - Dynamic User Data */}
        <div className="flex w-full justify-around bg-[#1a1a2e]/50 backdrop-blur-md rounded-xl p-3 border border-white/5 shadow-inner">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">{userEntries.filter(entry => entry.status === "APPROVED").length}</span>
            <span className="text-xs text-white/70">Approved</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">{pendingEntries.length}</span>
            <span className="text-xs text-white/70">Pending</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">₹{totalAmount.toFixed(2)}</span>
            <span className="text-xs text-white/70">Amount</span>
          </div>
        </div>
      </div>

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Send Flat Announcement</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSendAnnouncement();
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcement" className="text-white/90">
                Announcement Message
              </Label>
              <Textarea
                id="announcement"
                placeholder="Enter your announcement message for all flat members..."
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                className="w-full px-4 py-2 border border-white/10 bg-[#151525] text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition min-h-[120px] resize-none"
                maxLength={500}
              />
              <div className="text-right text-xs text-white/60">
                {announcementMessage.length}/500 characters
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAnnouncementDialog(false);
                  setAnnouncementMessage("");
                }}
                className="w-full sm:w-auto border-white/10 text-white hover:bg-white/10 bg-transparent"
                disabled={sendAnnouncementMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg"
                disabled={sendAnnouncementMutation.isPending || !announcementMessage.trim()}
              >
                {sendAnnouncementMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <HiSpeakerphone className="h-4 w-4 mr-2" />
                    Send Announcement
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}