import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { FiEdit2, FiSettings, FiLogOut, FiCamera, FiArrowLeft, FiMoon, FiBell } from "react-icons/fi";
import { MdOutlineCached } from "react-icons/md";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showSuccess, showError } from "@/services/toastService";


export function MobileProfileHeader() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [showMenu, setShowMenu] = useState(false);
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
            className="absolute top-14 right-4 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl p-2 z-50 w-40 animate-in fade-in slide-in-from-top-5 duration-300"
          >
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2 mb-1"
              onClick={() => {
                setShowMenu(false);
                // Add dark mode toggle action here
              }}
            >
              <FiMoon className="mr-2 h-4 w-4" />
              Dark Mode
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2 mb-1"
              onClick={() => {
                setShowMenu(false);
                // Add notifications action here
              }}
            >
              <FiBell className="mr-2 h-4 w-4" />
              Notifications
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2 mb-1"
              onClick={() => {
                setShowMenu(false);
                clearCacheMutation.mutate();
              }}
              disabled={clearCacheMutation.isPending}
            >
              <MdOutlineCached className="mr-2 h-4 w-4" />
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
              <FiLogOut className="mr-2 h-4 w-4" />
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
        <p className="text-white/70 text-sm mb-4">{user?.email || "No email"}</p>        {/* Stats - Dynamic User Data */}
        <div className="flex w-full justify-around bg-[#1a1a2e]/50 backdrop-blur-md rounded-xl p-3 border border-white/5 shadow-inner">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">{userEntries.length}</span>
            <span className="text-xs text-white/70">Entries</span>
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
    </div>
  );
}