import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";
import { LuUser, LuHistory, LuSettings } from "react-icons/lu";
import { FaCamera, FaEdit } from "react-icons/fa";
import { MdOutlineCached } from "react-icons/md";
import axios from "axios";
import { FiLogOut, FiUser } from "react-icons/fi";
import favicon from "../../favroomie.png";
import { Link } from "wouter";
import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/classic.css";
import Cropper from 'react-easy-crop';
import { Slider } from "@/components/ui/slider";
import { MobileNav } from "@/components/mobile-nav";
import { Header } from "@/components/header";

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

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
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

  const { data: activities = [] as Activity[] } = useQuery<Activity[]>({
    queryKey: ["/api/user/activities"],
    enabled: !!user,
  });
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
      toast({
        title: "Error",
        description: "Failed to save cropped image",
        variant: "destructive",
      });
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const res = await apiRequest("PATCH", `/api/user/profile`, data);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
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
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload profile picture",
        description: error.message,
        variant: "destructive",
      });
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
  });

  const clearActivitiesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/activities");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/activities"] });
      toast({
        title: "Activities cleared",
        description: "All activities have been cleared successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to clear activities",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFlatSettingsMutation = useMutation({
    mutationFn: async (data: { name?: string; minApprovalAmount?: number }) => {
      const res = await apiRequest("PATCH", `/api/flats/${user?.flatId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flats", user?.flatId] });
      toast({
        title: "Settings updated",
        description: "Flat settings have been updated successfully",
      });
      setIsEditingFlatSettings(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 via-[#241e95] to-indigo-800">
      <Header />
      {/* Main Content */}
      <main className="container mx-auto px-4 pt-32 pb-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Profile Settings</h1>
        </div>

        {/* Profile Grid */}
        <div className="grid gap-6 lg:grid-cols-[280px,1fr] xl:gap-8">
          {/* Sidebar */}
          <Card className="h-fit bg-white/5 backdrop-blur-lg border-white/10">
            <CardContent className="p-6">
              <div className="flex flex-col items-center space-y-6">
                {/* Avatar with Camera Icon */}
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-2 border-white/20 group-hover:border-white/40 transition-all">
                    <AvatarImage
                      src={user?.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-indigo-600 text-xl font-semibold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Camera Icon Overlay */}
                  <div
                    onClick={() => document.getElementById("profile-picture")?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-indigo-600 text-white rounded-full cursor-pointer 
                             hover:bg-indigo-700 transform hover:scale-105 transition-all shadow-lg"
                  >
                    <FaCamera className="h-4 w-4" />
                  </div>

                  <input
                    type="file"
                    id="profile-picture"
                    className="hidden"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                  />
                </div>

                <div className="text-center space-y-1.5">
                  <p className="text-base font-medium text-white">{user?.name}</p>
                  <p className="text-sm text-white/70">{user?.email}</p>
                </div>

                <Button
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-700 text-white 
                           font-medium py-2 rounded-lg shadow-md transition-all"
                >
                  <FiLogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardContent className="p-6">
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-white/10 rounded-lg p-1">
                  <TabsTrigger 
                    value="profile" 
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-white/70"
                  >
                    <LuUser className="h-4 w-4 mr-2" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger 
                    value="activity"
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-white/70"
                  >
                    <LuHistory className="h-4 w-4 mr-2" />
                    Activity
                  </TabsTrigger>
                  {user?.role === "ADMIN" && (
                    <TabsTrigger 
                      value="flat"
                      className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-white/70"
                    >
                      <LuSettings className="h-4 w-4 mr-2" />
                      Flat Settings
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="profile" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-white">Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-white">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => updateProfileMutation.mutate({ name, email })}
                        disabled={updateProfileMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        Save Changes
                      </Button>

                      <Button
                        onClick={() => clearCacheMutation.mutate()}
                        disabled={clearCacheMutation.isPending}
                        variant="outline"
                        className="bg-white/10 hover:bg-white/20 text-white border-0"
                      >
                        <MdOutlineCached className="mr-2" />
                        Clear Cache
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                      <Button
                        onClick={() => clearActivitiesMutation.mutate()}
                        disabled={clearActivitiesMutation.isPending}
                        variant="destructive"
                        size="sm"
                      >
                        Clear All
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {paginatedActivities.map((activity) => (
                        <div
                          key={activity._id}
                          className="p-4 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm 
                                   hover:bg-white/10 transition-all"
                        >
                          <p className="font-medium text-white">{activity.description}</p>
                          <p className="text-sm text-white/70 mt-1">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ))}

                      {activities.length === 0 && (
                        <div className="text-center py-8 text-white/70">
                          No recent activity
                        </div>
                      )}

                      {activities.length > 0 && (
                        <div className="mt-6">
                          <ResponsivePagination
                            current={currentPage}
                            total={totalPages}
                            onPageChange={setCurrentPage}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {user?.role === "ADMIN" && (
                  <TabsContent value="flat" className="mt-6">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-semibold text-white">Flat Settings</h3>
                        {!isEditingFlatSettings && (
                          <Button
                            onClick={() => setIsEditingFlatSettings(true)}
                            variant="outline"
                            className="border-white/20 bg-white/70 hover:bg-white/10"
                          >
                            <FaEdit className="mr-2" />
                            Edit Settings
                          </Button>
                        )}
                      </div>

                      {isEditingFlatSettings ? (
                        <div className="space-y-4 bg-white/5 rounded-lg p-4">
                          <div>
                            <Label htmlFor="flatName" className="text-white">Flat Name</Label>
                            <Input
                              id="flatName"
                              value={flatName}
                              onChange={(e) => setFlatName(e.target.value)}
                              className="bg-white/10 border-white/20 text-white"
                              placeholder="Enter flat name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="minApproval" className="text-white">Minimum Approval Amount (₹)</Label>
                            <Input
                              id="minApproval"
                              type="number"
                              value={minApprovalAmount}
                              onChange={(e) => setMinApprovalAmount(e.target.value)}
                              className="bg-white/10 border-white/20 text-white"
                              placeholder="Enter minimum amount"
                            />
                          </div>
                          <div className="flex gap-3">
                            <Button
                              onClick={() => updateFlatSettingsMutation.mutate({
                                name: flatName,
                                minApprovalAmount: Number(minApprovalAmount)
                              })}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                              Save Settings
                            </Button>
                            <Button
                              onClick={() => {
                                setIsEditingFlatSettings(false);
                                // Reset form values
                                setFlatName(flat?.name || "");
                                setMinApprovalAmount(flat?.minApprovalAmount?.toString() || "");
                              }}
                              className="bg-white/10 hover:bg-white/20 text-white border-0"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-white/5 p-4 rounded-lg">
                            <Label className="text-white/70">Flat ID</Label>
                            <p className="text-white font-medium mt-1">{user?.flatId}</p>
                          </div>
                          {flat && (
                            <>
                              <div className="bg-white/5 p-4 rounded-lg">
                                <Label className="text-white/70">Flat Name</Label>
                                <p className="text-white font-medium mt-1">{flat.name}</p>
                              </div>
                              <div className="bg-white/5 p-4 rounded-lg">
                                <Label className="text-white/70">Minimum Approval Amount</Label>
                                <p className="text-white font-medium mt-1">₹{flat.minApprovalAmount || '0'}</p>
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
        <DialogContent className="bg-white/10 backdrop-blur-lg border-white/20">
          <div className="h-[400px] relative">
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
          
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label className="text-white">Zoom</Label>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={([value]) => setZoom(value)}
                className="py-4"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsCropperOpen(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropSave}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Navigation */}
      <div className="block md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
