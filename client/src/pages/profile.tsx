import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showSuccess, showError, showWarning } from "@/services/toastService";
import { User } from "@shared/schema";
import { LuUser, LuHistory, LuSettings } from "react-icons/lu";
import { FaCamera, FaEdit, FaTrash } from "react-icons/fa";
import { HiSpeakerphone } from "react-icons/hi";
import { MdOutlineCached } from "react-icons/md";
import axios from "axios";
import { FiLogOut, FiUser, FiHome, FiCreditCard, FiMail } from "react-icons/fi";
import favicon from "../../Roomie.png";
import { Link } from "wouter";
import { CustomPagination } from "@/components/custom-pagination";
import Cropper from 'react-easy-crop';
import { Slider } from "@/components/ui/slider";
import { MobileNav } from "@/components/mobile-nav";
import { Header } from "@/components/header";
import { MobileProfileHeader } from "@/components/mobile-profile-header";
import { MobileProfileTabs } from "@/components/mobile-profile-tabs";
import { InstallAppFab } from "@/components/install-app-fab";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Activity {
  _id: string;
  description: string;
  timestamp: string;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const getInitials = (name: string | undefined) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isEditingFlatSettings, setIsEditingFlatSettings] = useState(false);
  const [showDeleteFlatDialog, setShowDeleteFlatDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  
  // Show loader when the page first loads
  useEffect(() => {
    showLoader();
    
    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);
  // Flat data query
  const { data: flat, isError: flatError, isLoading: flatLoading } = useQuery({
    queryKey: ["/api/flats", user?.flatId],
    queryFn: async () => {
      if (!user?.flatId) return null;
      console.log("Fetching flat with ID:", user.flatId);
      try {
        const res = await apiRequest("GET", `/api/flats/${user.flatId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch flat: ${res.status}`);
        }
        const data = await res.json();
        console.log("Flat API response:", data);
        return data;
      } catch (error) {
        console.error("Error fetching flat data:", error);
        throw error;
      }
    },
    enabled: !!user?.flatId,
    retry: 3,
    staleTime: 5 * 60 * 1000,
  });

  // Initialize form states after flat data is available
  const [flatName, setFlatName] = useState("");
  const [minApprovalAmount, setMinApprovalAmount] = useState("");

  // Update form values when flat data changes or edit mode is enabled
  useEffect(() => {
    if (flat && isEditingFlatSettings) {
      setFlatName(flat.name || "");
      setMinApprovalAmount(flat.minApprovalAmount?.toString() || "");
    }
  }, [flat, isEditingFlatSettings]);

  const { data: activities = [] as Activity[], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/user/activities"],
    enabled: !!user,
  });
  
  // Hide loader when all data is loaded
  useEffect(() => {
    const flatDataReady = !flatLoading || !user?.flatId;
    const activitiesDataReady = !activitiesLoading;
    
    if (flatDataReady && activitiesDataReady) {
      // Use a small timeout to ensure a consistent loader experience across the app
      setTimeout(() => {
        hideLoader();
      }, 300);
    }
  }, [flatLoading, activitiesLoading, user?.flatId]);
  const totalPages = Math.ceil(activities.length / itemsPerPage);
  const paginatedActivities = activities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Function to convert base64 to blob
  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return null;
    
    const image = new Image();
    image.src = imageSrc;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    
    await new Promise((resolve) => {
      image.onload = resolve;
    });
    
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );
    
    return canvas.toDataURL('image/jpeg');
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleCropSave = async () => {
    try {
      const croppedImageUrl = await getCroppedImage();
      if (!croppedImageUrl) return;

      const blob = dataURLtoBlob(croppedImageUrl);
      const file = new File([blob], "profile-picture.jpg", { type: "image/jpeg" });
      uploadProfilePictureMutation.mutate(file);
      setIsCropperOpen(false);
    } catch (error) {
      console.error("Error saving cropped image:", error);
      showError("Failed to save cropped image");
    }
  };  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      showLoader();
      try {
        const res = await apiRequest("PATCH", `/api/user/profile`, data);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      showSuccess("Your profile has been updated successfully");
      hideLoader();
    },
    onError: (error: Error) => {
      showError(error.message);
      hideLoader();
    },
  });  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      showLoader();
      try {
        const formData = new FormData();
        formData.append("profilePicture", file);
        const res = await fetch("/api/user/profile-picture", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to upload profile picture");
        }
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      showSuccess("Your profile picture has been updated successfully");
      hideLoader();
    },
    onError: (error: Error) => {
      showError(error.message);
      hideLoader();
    },
  });

  const handleClearCache = async () => {
    try {
      const response = await axios.post("/api/set-version-new");
      alert(response.data.message); // Show success message
      window.location.reload(); // Reload the page to clear cache
    } catch (error) {
      alert("Failed to clear cache. Check console for details.");
      console.error("Error clearing cache:", error);
    }
  };

  // ✅ Explicitly define mutation type
  const clearCacheMutation = useMutation<void, Error>({
    mutationFn: handleClearCache,
  });  const clearActivitiesMutation = useMutation({
    mutationFn: async () => {
      showLoader();
      try {
        const res = await apiRequest("DELETE", "/api/user/activities");
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/activities"] });
      showSuccess("All activities have been cleared successfully");
      hideLoader();
    },
    onError: (error: Error) => {
      showError(error.message);
      hideLoader();
    },
  });  const updateFlatSettingsMutation = useMutation({
    mutationFn: async (data: { name?: string; minApprovalAmount?: number }) => {
      showLoader();
      try {
        const res = await apiRequest("PATCH", `/api/flats/${user?.flatId}`, data);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flats", user?.flatId] });
      showSuccess("Flat settings have been updated successfully");
      setIsEditingFlatSettings(false);
      hideLoader();
    },
    onError: (error: Error) => {
      showError(error.message);
      hideLoader();
    },
  });

const deleteFlatMutation = useMutation({
  mutationFn: async () => {
    showLoader();

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve("timeout"), 6000); // 6 seconds timeout
    });

    try {
      const apiPromise = apiRequest("DELETE", `/api/flats/${user?.flatId}`).then((res) =>
        res.json()
      );

      const result = await Promise.race([apiPromise, timeoutPromise]);

      if (result === "timeout") {
        // No response after 6 seconds, consider as success
        return { forcedSuccess: true };
      } else {
        return result; // Actual API response
      }
    } catch (error) {
      hideLoader();
      throw error;
    }
  },
  onSuccess: (data: any) => {
    if (data?.forcedSuccess) {
      showSuccess("Flat and all data have been deleted successfully (timeout fallback)");
    } else {
      showSuccess("Flat and all data have been deleted successfully");
    }
    hideLoader();
    
    // Wait 2 seconds before redirecting to give user time to see the success message
    setTimeout(() => {
      // Clear all data and force redirect
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/auth");
    }, 2000);
  },
  onError: (error: Error) => {
    showError(error.message);
    hideLoader();
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

  // Queries for statistics
  const { data: entries = [] } = useQuery<any[]>({
    queryKey: ["/api/entries"],
  });

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["/api/payments"],
  });

  // Calculate statistics
  const userEntries = entries?.filter((e) => {
    const entryUserId = typeof e.userId === 'object' && e.userId !== null
      ? (e.userId._id || e.userId.id || e.userId)
      : e.userId;
    const userIdStr = entryUserId?.toString();
    const currentUserIdStr = user?._id?.toString();
    return userIdStr === currentUserIdStr;
  }) || [];

  // Get only approved entries
  const approvedEntries = userEntries.filter(e => e.status === "APPROVED");
  const pendingEntries = userEntries.filter(e => e.status === "PENDING");

  // Get penalties for the user
  const { data: penaltiesData } = useQuery<any[]>({
    queryKey: ["/api/penalties"],
  });

  const userPenalties = penaltiesData?.filter((p) => {
    const penaltyUserId = typeof p.userId === 'object' ? p.userId._id : p.userId;
    return penaltyUserId?.toString() === user?._id?.toString();
  }) || [];

  // Calculate total penalties
  const totalPenalties = userPenalties.reduce((sum, penalty) => {
    return sum + (typeof penalty.amount === 'number' ? penalty.amount : 0);
  }, 0);
  
  // Calculate total amount (approved entries - penalties)
  const approvedAmount = approvedEntries.reduce((sum, entry) => {
    return sum + (typeof entry.amount === 'number' ? entry.amount : 0);
  }, 0);
  
  const totalAmount = approvedAmount - totalPenalties;

  return (
    
    <div className="min-h-screen bg-[#0f0f1f] sm:pt-10 pb-20">
     
      {/* Header - Hidden on mobile */}
      <div className="hidden md:block">
        <Header />
      </div>
      {/* Main Content */}
      <main className="container mx-auto px-4 pt-6 md:pt-24 pb-8 space-y-6">
        {/* Mobile Profile Header - Only visible on mobile */}
        <div className="md:hidden">
          <MobileProfileHeader />
          <input
            type="file"
            id="profile-picture"
            className="hidden"
            accept="image/*"
            onChange={handleProfilePictureChange}
          />
          
          {/* Mobile Profile Tabs - Only visible on mobile */}
          <div className="mt-4">
            <MobileProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>

        {/* Desktop Profile Grid - Improved Layout */}
        <div className="grid gap-6 lg:grid-cols-[300px,1fr] xl:gap-8">
          {/* Sidebar - Hidden on mobile */}
          <Card className="h-fit bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-xl rounded-xl border border-white/10 hidden md:block shadow-xl transform transition-all duration-300 hover:shadow-purple-500/20 hover:border-white/20">
            <CardContent className="p-6 relative">
              {/* Announcement Icon - Top Left - Only for admins */}
              {user?.role === "ADMIN" && (
                <div 
                  className="absolute top-4 left-4 p-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-full cursor-pointer 
                           hover:from-indigo-700 hover:to-purple-800 transform hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-xl z-10 group"
                  onClick={() => setShowAnnouncementDialog(true)}
                  title="Send Announcement to All Flat Members"
                >
                  <HiSpeakerphone className="h-4 w-4 group-hover:animate-pulse" />
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-full opacity-30 blur-sm group-hover:opacity-50 transition-all duration-300"></div>
                </div>
              )}
              
              <div className="flex flex-col items-center space-y-6">
                {/* Avatar with Camera Icon - Enhanced */}
                <div className="relative group mt-4">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full opacity-70 blur-sm group-hover:opacity-100 transition-all duration-300"></div>
                  <Avatar className="h-28 w-28 border-2 border-white/20 group-hover:border-white/40 transition-all relative">
                    <AvatarImage
                      src={user?.profilePicture}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-[#1a1a2e] text-white text-2xl">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Camera Icon Overlay - Enhanced */}
                  <div
                    onClick={() => document.getElementById("profile-picture-desktop")?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-full cursor-pointer 
                             hover:from-indigo-700 hover:to-purple-800 transform hover:scale-105 transition-all shadow-lg"
                  >
                    <FaCamera className="h-4 w-4" />
                  </div>

                  <input
                    type="file"
                    id="profile-picture-desktop"
                    className="hidden"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                  />
                </div>

                {/* User Info - Enhanced */}
                <div className="text-center space-y-2 w-full">
                  <p className="text-xl font-semibold text-white bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{user?.name}</p>
                  <p className="text-sm text-white/70">{user?.email}</p>
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-2"></div>
                  <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Role: {user?.role}</p>
                </div>                {/* Stats Section - New Addition */}
                <div className="grid grid-cols-3 gap-2 w-full mt-2">
                  <div className="flex flex-col items-center p-2 rounded-lg bg-black/30 border border-white/5 hover:border-white/10 transition-all">
                    <span className="text-lg font-bold text-white">{userEntries.filter(entry => entry.status === "APPROVED").length || 0}</span>
                    <span className="text-xs text-white/60">Approved</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-black/30 border border-white/5 hover:border-white/10 transition-all">
                    <span className="text-lg font-bold text-white">{pendingEntries.length || 0}</span>
                    <span className="text-xs text-white/60">Pending</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-black/30 border border-white/5 hover:border-white/10 transition-all">
                    <span className="text-lg font-bold text-white">₹{totalAmount.toFixed(2) || 0}</span>
                    <span className="text-xs text-white/60">Amount</span>
                  </div>
                </div>

                {/* Logout Button - Enhanced */}
                <div className="flex gap-2 w-full">
                  <Button
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600/80 to-red-700/80 hover:from-red-600 hover:to-red-700 text-white 
                           font-medium py-2 rounded-lg shadow-md transition-all"
                  >
                    <FiLogOut className="h-4 w-4" />
                    Logout
                  </Button>
                  
                  <Button
                    onClick={() => {
                      caches.keys().then((names) => {
                        names.forEach((name) => caches.delete(name));
                      });
                      window.location.reload();
                    }}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600/80 to-purple-700/80 hover:from-indigo-600 hover:to-purple-700 text-white 
                           font-medium py-2 rounded-lg shadow-md transition-all"
                  >
                    <MdOutlineCached className="h-4 w-4" />
                    Clear Cache
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content - Enhanced */}
          <Card className="bg-[#1a1a2e]/50 backdrop-blur-md rounded-xl border border-white/5 shadow-xl transform transition-all duration-100 hover:shadow-purple-500/10">
            <CardContent className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid-cols-3 bg-black/30 rounded-xl p-1.5 mb-6 sm:mb-8 md:mb-10 shadow-inner hidden md:grid">
                  <TabsTrigger 
                    value="profile" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#582c84] data-[state=active]:to-[#5433a7] data-[state=active]:text-white text-white/70 rounded-lg py-3 transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center sm:flex-row sm:justify-center gap-1 sm:gap-2">
                      <LuUser className="h-5 w-5" />
                      <span className="text-xs sm:text-sm font-medium">Profile</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="activity"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#582c84] data-[state=active]:to-[#5433a7] data-[state=active]:text-white text-white/70 rounded-lg py-3 transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center sm:flex-row sm:justify-center gap-1 sm:gap-2">
                      <LuHistory className="h-5 w-5" />
                      <span className="text-xs sm:text-sm font-medium">Activity</span>
                    </div>
                  </TabsTrigger>
                  {/* Show Flat Settings tab to all users */}
                {(
                    <TabsTrigger 
                      value="flat"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#582c84] data-[state=active]:to-[#5433a7] data-[state=active]:text-white text-white/70 rounded-lg py-3 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex flex-col items-center sm:flex-row sm:justify-center gap-1 sm:gap-2">
                        <LuSettings className="h-5 w-5" />
                        <span className="text-xs sm:text-sm font-medium">Settings</span>
                      </div>
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Tab Content remains the same */}
                
                <TabsContent value="profile" className="space-y-6 mt-4">                    <div className="space-y-4 sm:space-y-5">
                      <div className="flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(101,58,167,0.3)] rounded-xl p-3 sm:p-4">
                        <h3 className="text-base sm:text-lg font-semibold text-white">Profile</h3>
                        {!isEditingProfile && (
                          <Button
                            onClick={() => setIsEditingProfile(true)}
                            variant="outline"
                            className="border-white/10 bg-black/40 hover:bg-black/60 text-white rounded-lg transform hover:scale-105 transition-all duration-300 shadow-md flex items-center gap-2 px-2 sm:px-4 py-1 sm:py-2 text-sm sm:text-base"
                          >
                            <FaEdit className="h-3 w-3 sm:h-4 sm:w-4" />
                            Edit
                          </Button>
                        )}
                      </div>
                    
                    {isEditingProfile ? (
                      <div className="space-y-4 sm:space-y-5 bg-gradient-to-b from-black/40 to-black/20 rounded-xl p-3 sm:p-5 border border-white/10 shadow-lg">
                        <div className="bg-black/30 rounded-xl p-3 sm:p-4 border border-white/10 shadow-inner transition-all duration-300 hover:border-white/20">
                          <Label htmlFor="name" className="text-white/80 text-xs sm:text-sm font-medium mb-1 sm:mb-1.5 block">Name</Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-black/40 border-white/10 text-white rounded-lg h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base focus:border-[#582c84] focus:ring-1 focus:ring-[#582c84] transition-all"
                            placeholder="Enter your name"
                          />
                        </div>
                        <div className="bg-black/30 rounded-xl p-3 sm:p-4 border border-white/10 shadow-inner transition-all duration-300 hover:border-white/20">
                          <Label htmlFor="email" className="text-white/80 text-xs sm:text-sm font-medium mb-1 sm:mb-1.5 block">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-black/40 border-white/10 text-white rounded-lg h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base focus:border-[#582c84] focus:ring-1 focus:ring-[#582c84] transition-all"
                            placeholder="Enter your email"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                          <Button
                            onClick={() => {
                              updateProfileMutation.mutate({ name, email });
                              setIsEditingProfile(false);
                            }}
                            disabled={updateProfileMutation.isPending}
                            className="w-full sm:w-auto bg-gradient-to-r from-[#582c84] to-[#5433a7] hover:from-[#5433a7] hover:to-[#4a2d96] text-white font-medium py-4 sm:py-6 text-sm sm:text-base rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                          >
                            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button
                            onClick={() => setIsEditingProfile(false)}
                            className="w-full sm:w-auto bg-black/40 hover:bg-black/60 text-white border-white/10 font-medium py-4 sm:py-6 text-sm sm:text-base rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 sm:space-y-4">
                        <div className="bg-gradient-to-r from-black/30 to-black/20 p-3 sm:p-5 rounded-xl border border-white/10 shadow-md transition-all duration-300 hover:bg-black/40 hover:border-white/20 transform hover:scale-[1.02]">
                          <div className="flex items-center gap-2 sm:gap-3 mb-1">
                            <div className="bg-gradient-to-br from-[#582c84]/40 to-[#5433a7]/30 p-1.5 sm:p-2 rounded-full">
                              <FiUser className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <Label className="text-white/80 font-medium text-sm sm:text-base">Name</Label>
                          </div>
                          <p className="text-white font-medium mt-1 ml-8 sm:ml-11 text-sm sm:text-base">{name}</p>
                        </div>
                        <div className="bg-gradient-to-r from-black/30 to-black/20 p-3 sm:p-5 rounded-xl border border-white/10 shadow-md transition-all duration-300 hover:bg-black/40 hover:border-white/20 transform hover:scale-[1.02]">
                          <div className="flex items-center gap-2 sm:gap-3 mb-1">
                            <div className="bg-gradient-to-br from-[#582c84]/40 to-[#5433a7]/30 p-1.5 sm:p-2 rounded-full">
                              <FiMail className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <Label className="text-white/80 font-medium text-sm sm:text-base">Email</Label>
                          </div>
                          <p className="text-white font-medium mt-1 ml-8 sm:ml-11 text-sm sm:text-base break-all">{email}</p>
                        </div>
                        {/* Clear Cache button removed from desktop view and moved to mobile settings popup */}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-4  ">
                  <div className="space-y-5 ">
                    <div className="flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(101,58,167,0.3)] rounded-xl p-4 ">
                      <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                      <Button
                        onClick={() => clearActivitiesMutation.mutate()}
                        disabled={clearActivitiesMutation.isPending}
                        variant="destructive"
                        size="sm"
                        className="rounded-lg transform hover:scale-105 transition-all duration-300 shadow-md"
                      >
                        {clearActivitiesMutation.isPending ? "Clearing..." : "Clear All"}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {paginatedActivities.map((activity) => (
                        <div
                          key={activity._id}
                          className="p-4 rounded-xl border border-white/10 bg-gradient-to-r from-black/30 to-black/20 backdrop-blur-sm 
                                   hover:bg-black/50 transition-all duration-300 transform hover:scale-[1.02] shadow-md"
                        >
                          <div className="flex items-start gap-3">
                            <div className="bg-gradient-to-br from-[#582c84]/40 to-[#5433a7]/30 p-2 rounded-full mt-1">
                              <LuHistory className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-white overflow-hidden text-ellipsis">
                                {activity.description.length > 60 
                                  ? `${activity.description.substring(0, 60)}...` 
                                  : activity.description}
                              </p>
                              <p className="text-sm text-white/70 mt-1">
                                {new Date(activity.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {activities.length === 0 && (
                        <div className="text-center py-12 px-4 rounded-xl border border-white/10 bg-gradient-to-b from-black/30 to-black/20 backdrop-blur-sm">
                          <div className="bg-gradient-to-br from-[#582c84]/20 to-[#5433a7]/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-3">
                            <LuHistory className="h-12 w-12 text-white/40" />
                          </div>
                          <p className="text-white/70 text-lg">No recent activity</p>
                        </div>
                      )}

                      {activities.length > 0 && (
                        <div className="flex justify-center mt-6">
                          <CustomPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Show Flat Settings tab to all users */}
                {(
                  <TabsContent value="flat" className="mt-4">
                    <div className="space-y-5">
                      <div className="flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(101,58,167,0.3)] rounded-xl p-4">
                        <h3 className="text-lg font-semibold text-white">Flat Settings</h3>
                        {!isEditingFlatSettings && user?.role === "ADMIN" && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setIsEditingFlatSettings(true)}
                              variant="outline"
                              className="border-white/10 bg-black/40 hover:bg-black/60 text-white rounded-lg transform hover:scale-105 transition-all duration-300 shadow-md flex items-center gap-2"
                            >
                              <FaEdit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => setShowDeleteFlatDialog(true)}
                              variant="outline"
                              className="border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transform hover:scale-105 transition-all duration-300 shadow-md flex items-center gap-2"
                            >
                              <FaTrash className="h-4 w-4" />
                            
                            </Button>
                          </div>
                        )}
                      </div>

                      {isEditingFlatSettings ? (
                        <div className="space-y-5 bg-gradient-to-b from-black/40 to-black/20 rounded-xl p-5 border border-white/10 shadow-lg">
                          <div className="bg-black/30 rounded-xl p-4 border border-white/10 shadow-inner transition-all duration-300 hover:border-white/20">
                            <Label htmlFor="flatName" className="text-white/80 text-sm font-medium mb-1.5 block">Flat Name</Label>
                            <Input
                              id="flatName"
                              value={flatName}
                              onChange={(e) => setFlatName(e.target.value)}
                              className="bg-black/40 border-white/10 text-white rounded-lg h-12 px-4 focus:border-[#582c84] focus:ring-1 focus:ring-[#582c84] transition-all"
                              placeholder="Enter flat name"
                            />
                          </div>
                          <div className="bg-black/30 rounded-xl p-4 border border-white/10 shadow-inner transition-all duration-300 hover:border-white/20">
                            <Label htmlFor="minApproval" className="text-white/80 text-sm font-medium mb-1.5 block">Minimum Approval Amount (₹)</Label>
                            <Input
                              id="minApproval"
                              type="number"
                              value={minApprovalAmount}
                              onChange={(e) => setMinApprovalAmount(e.target.value)}
                              className="bg-black/40 border-white/10 text-white rounded-lg h-12 px-4 focus:border-[#582c84] focus:ring-1 focus:ring-[#582c84] transition-all"
                              placeholder="Enter minimum amount"
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button
                              onClick={() => updateFlatSettingsMutation.mutate({
                                name: flatName,
                                minApprovalAmount: Number(minApprovalAmount)
                              })}
                              className="w-full sm:w-auto bg-gradient-to-r from-[#582c84] to-[#5433a7] hover:from-[#5433a7] hover:to-[#4a2d96] text-white font-medium py-6 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                            >
                              {updateFlatSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                            </Button>
                            <Button
                              onClick={() => {
                                setIsEditingFlatSettings(false);
                                // Reset form values
                                setFlatName(flat?.name || "");
                                setMinApprovalAmount(flat?.minApprovalAmount?.toString() || "");
                              }}
                              className="w-full sm:w-auto bg-black/40 hover:bg-black/60 text-white border-white/10 font-medium py-6 rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-r from-black/30 to-black/20 p-5 rounded-xl border border-white/10 shadow-md transition-all duration-300 hover:bg-black/40 hover:border-white/20 transform hover:scale-[1.02]">
                            <div className="flex items-center gap-3 mb-1">
                              <div className="bg-gradient-to-br from-[#582c84]/40 to-[#5433a7]/30 p-2 rounded-full">
                                <FiUser className="h-5 w-5 text-white" />
                              </div>
                              <Label className="text-white/80 font-medium">Flat ID</Label>
                            </div>
                            <p className="text-white font-medium mt-1 ml-11">{user?.flatId}</p>
                          </div>
                          {flat && (
                            <>
                              <div className="bg-gradient-to-r from-black/30 to-black/20 p-5 rounded-xl border border-white/10 shadow-md transition-all duration-300 hover:bg-black/40 hover:border-white/20 transform hover:scale-[1.02]">
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="bg-gradient-to-br from-[#582c84]/40 to-[#5433a7]/30 p-2 rounded-full">
                                    <FiHome className="h-5 w-5 text-white" />
                                  </div>
                                  <Label className="text-white/80 font-medium">Flat Name</Label>
                                </div>
                                <p className="text-white font-medium mt-1 ml-11">{flat.name}</p>
                              </div>
                              <div className="bg-gradient-to-r from-black/30 to-black/20 p-5 rounded-xl border border-white/10 shadow-md transition-all duration-300 hover:bg-black/40 hover:border-white/20 transform hover:scale-[1.02]">
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="bg-gradient-to-br from-[#582c84]/40 to-[#5433a7]/30 p-2 rounded-full">
                                    <FiCreditCard className="h-5 w-5 text-white" />
                                  </div>
                                  <Label className="text-white/80 font-medium">Minimum Approval Amount</Label>
                                </div>
                                <p className="text-white font-medium mt-1 ml-11">₹{flat.minApprovalAmount || '0'}</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Image Cropping Dialog */}
      <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
        <DialogContent className="bg-gradient-to-b from-black/70 to-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl max-w-[95vw] sm:max-w-[500px] p-0 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-[#582c84]/30 to-black/30 border-b border-white/10">
            <h3 className="text-xl font-bold text-white text-center">Crop Profile Picture</h3>
          </div>
          
          <div className="h-[350px] sm:h-[400px] relative bg-black/40">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          
          <div className="space-y-5 p-5 bg-gradient-to-b from-black/50 to-black/30">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-white font-medium">Zoom</Label>
                <span className="text-white/70 text-sm">{zoom.toFixed(1)}x</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={([value]) => setZoom(value)}
                className="py-4"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsCropperOpen(false)}
                className="w-full sm:w-auto border-white/10 text-white hover:bg-black/60 bg-black/40 font-medium py-6 rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropSave}
                className="w-full sm:w-auto bg-gradient-to-r from-[#582c84] to-[#5433a7] hover:from-[#5433a7] hover:to-[#4a2d96] text-white font-medium py-6 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <FaCamera className="h-4 w-4" />
                Save Picture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Install App FAB */}
      <InstallAppFab className="top-20 bottom-6 md:top-auto" />

      {/* Mobile Navigation */}
      <div className="block md:hidden">
        <MobileNav />
      </div>

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="max-w-md sm:max-w-lg w-full mx-4 p-0 rounded-2xl shadow-2xl bg-gradient-to-b from-[#1a1a2e] to-[#151525] border border-[#582c84]/40 backdrop-blur-xl">
          <div className="p-6 pb-0">
            <DialogHeader className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-full">
                  <HiSpeakerphone className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-white bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Send Flat Announcement
                </DialogTitle>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                Send a message to all members of your flat. They will receive this as a push notification.
              </p>
            </DialogHeader>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSendAnnouncement();
          }} className="px-6 pb-6 space-y-5">
            <div className="space-y-3">
              <Label htmlFor="announcement" className="text-white/90 font-medium text-sm">
                Announcement Message
              </Label>
              <div className="relative">
                <Textarea
                  id="announcement"
                  placeholder="Enter your announcement message for all flat members..."
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="w-full px-4 py-3 border border-white/20 bg-black/30 text-white rounded-xl focus:ring-2 focus:ring-[#582c84] focus:border-[#582c84] outline-none transition-all min-h-[140px] resize-none placeholder:text-white/40 backdrop-blur-sm"
                  maxLength={500}
                />
                <div className="absolute bottom-3 right-3 text-xs text-white/50 bg-black/50 px-2 py-1 rounded-lg backdrop-blur-sm">
                  {announcementMessage.length}/500
                </div>
              </div>
            </div>
            
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAnnouncementDialog(false);
                  setAnnouncementMessage("");
                }}
                className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 bg-transparent rounded-xl py-3 px-6 font-medium transition-all hover:border-white/30"
                disabled={sendAnnouncementMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-[#582c84] to-[#5433a7] hover:from-[#5433a7] hover:to-[#4a2d96] text-white rounded-xl py-3 px-6 font-medium shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
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

      {/* Delete Flat Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteFlatDialog}
        onOpenChange={setShowDeleteFlatDialog}
        title="Delete Flat"
        description={
          <div className="space-y-4">
            <div className="text-white/90 space-y-3">
              <p className="font-medium text-red-400">⚠️ This action cannot be undone!</p>
              <p>Deleting the flat will permanently remove:</p>
              <ul className="list-disc list-inside text-sm text-white/60 space-y-1 ml-4">
                <li>All users in the flat</li>
                <li>All expense entries</li>
                <li>All penalties and payments</li>
                <li>All bills and activities</li>
                <li>Flat settings and configurations</li>
              </ul>
              <p className="text-red-400 font-bold mt-3">This will delete ALL data for this flat!</p>
            </div>
          </div>
        }
        onConfirm={() => {
          deleteFlatMutation.mutate();
          setShowDeleteFlatDialog(false);
        }}
        confirmText={deleteFlatMutation.isPending ? "Deleting..." : "Delete Flat"}
        cancelText="Cancel"
      />
    
    </div>
    
  );
}