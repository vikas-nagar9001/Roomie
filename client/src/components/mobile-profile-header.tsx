import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { FiEdit2, FiSettings, FiLogOut, FiCamera } from "react-icons/fi";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";


export function MobileProfileHeader() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await logoutMutation.mutateAsync();
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="relative">
      {/* Gradient Background */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#6636a3] to-[#0f0f1f] z-0" />
      
      {/* Profile Content */}
      <div className="relative z-10 pt-6 pb-4 px-4 flex flex-col items-center">
        {/* Settings Button */}
        <div className="absolute top-4 right-4 flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
            onClick={() => setShowMenu(!showMenu)}
          >
            <FiSettings className="h-5 w-5" />
          </Button>
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute top-14 right-4 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl p-2 z-50 w-40 animate-in fade-in slide-in-from-top-5 duration-300">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2 mb-1"
              onClick={() => {
                setShowMenu(false);
                // Add edit profile action here
              }}
            >
              <FiEdit2 className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-lg py-2"
              onClick={handleSignOut}
              disabled={logoutMutation.isPending}
            >
              <FiLogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        )}

        {/* Avatar */}
        <div className="mb-4 p-1 rounded-full bg-gradient-to-r from-[#ab6cff] to-[#6636a3] shadow-xl relative group">
          <Avatar className="h-24 w-24 border-4 border-[#0f0f1f]/50">
            <AvatarImage src={user?.profilePicture} alt={user?.name || "User"} />
            <AvatarFallback className="bg-[#1a1a2e] text-white text-2xl">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          
          {/* Camera Icon Overlay */}
          <div
            onClick={() => document.getElementById("profile-picture")?.click()}
            className="absolute bottom-0 right-0 p-3 bg-indigo-600 text-white rounded-full cursor-pointer 
                     hover:bg-indigo-700 transform hover:scale-105 transition-all shadow-lg"
          >
            <FiCamera className="h-4 w-4" />
          </div>
        </div>

        {/* User Info */}
        <h2 className="text-xl font-bold text-white mb-1">{user?.name || "User"}</h2>
        <p className="text-white/70 text-sm mb-4">{user?.email || "No email"}</p>

        {/* Stats */}
        <div className="flex w-full justify-around bg-[#1a1a2e]/50 backdrop-blur-md rounded-xl p-3 border border-white/5 shadow-inner">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">12</span>
            <span className="text-xs text-white/70">Entries</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">₹2,400</span>
            <span className="text-xs text-white/70">Paid</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">₹0</span>
            <span className="text-xs text-white/70">Due</span>
          </div>
        </div>
      </div>
    </div>
  );
}