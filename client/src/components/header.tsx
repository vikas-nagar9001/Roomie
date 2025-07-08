import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FiUser, FiBell } from "react-icons/fi";
import { HiSpeakerphone } from "react-icons/hi";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showSuccess, showError } from "@/services/toastService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
const Logo = "/static/images/Roomie.png";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const getInitials = (name: string | undefined) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export function Header() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");

  // Replace with your actual unread notification count
  const unreadCount = 3;

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

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-[#0f0f1f] p-3 ">
      <div className={`flex justify-between items-center ${location !== '/' ? 'pl-4 pr-4 pt-3' : 'pl-1 pr-1 pt-3'}`}>
        <Link to="/" className="flex items-center gap-3">
          <img src={Logo} alt="Logo" className="h-16 w-24" />
        </Link>

        <div className="flex items-center gap-4">
          {/* Announcement Icon - only for admins */}
          {user?.role === "ADMIN" && (
            <div 
              className="relative hidden sm:flex items-center justify-center cursor-pointer"
              onClick={() => setShowAnnouncementDialog(true)}
            >
              <HiSpeakerphone className="w-6 h-6 text-white/80 hover:text-[#ab6cff] transition" />
            </div>
          )}

          {/* Notification Bell with Badge - hidden on mobile, visible on sm+ */}
          <Link to="">
            <div className="relative hidden sm:flex items-center justify-center cursor-pointer">
              <FiBell className="w-6 h-6 text-white/80 hover:text-[#ab6cff] transition" />
              {unreadCount > 0 && (
                <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#0f0f1f] shadow-md">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </Link>

          <Link href="/profile">
            <div className="relative group cursor-pointer">
              <div className="p-[2px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 ring-2 ring-white/30 group-hover:ring-white/50 transition-all shadow-xl">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={user?.profilePicture} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute top-0 left-0 w-full h-full bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </Link>
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
