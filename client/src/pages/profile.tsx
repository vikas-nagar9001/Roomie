import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";
import { LuUser, LuHistory, LuSettings } from "react-icons/lu";
import { FaCamera } from "react-icons/fa";  // Ensure correct import from react-icons/fa for camera icon
import { FiUsers, FiList, FiLogOut, FiUser, FiCreditCard } from "react-icons/fi";

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const { data: activities } = useQuery({
    queryKey: ["/api/user/activities"],
    enabled: !!user,
  });

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

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadProfilePictureMutation.mutate(file);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-indigo-600 via-[#241e95] to-indigo-800  text-white">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Profile Settings</h1>
        </div>

        <div className="grid gap-8 md:grid-cols-[240px,1fr]">
          {/* Sidebar */}

          <Card>
            <CardContent className="p-6 relative">
              <div className="flex flex-col items-center space-y-4">
                {/* Avatar with Camera Icon Overlay */}
                <div className="relative">
                  <Avatar className="h-24 w-24 border-2">
                    <AvatarImage
                      src={user?.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"}
                    />
                    <AvatarFallback>
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Camera Icon Overlay */}
                  <div
                    onClick={() => document.getElementById("profile-picture")?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full cursor-pointer hover:bg-opacity-80"
                  >
                    <FaCamera className="text-xm" /> {/* React Camera Icon */}
                  </div>

                  {/* Hidden File Input for Profile Picture Change */}
                  <input
                    type="file"
                    id="profile-picture"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleProfilePictureChange(e)} // Function to handle the file input change
                  />
                </div>

                <p className="text-sm font-semibold text-white">{user?.name}</p>
                <p className="text-sm text-muted-foreground text-slate-100">{user?.email}</p>
              </div>
            </CardContent>

            {/* Centering the logout button */}
            <div className="flex justify-center py-4">
              <Button
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all"
              >
                <FiLogOut className="h-5 w-5 text-white" />
                Logout
              </Button>
            </div>
          </Card>





          {/* Main Content */}
          <Card>
            <CardContent className="p-6">
              <Tabs defaultValue="profile">
                <TabsList className="grid w-full grid-cols-3 bg-white/80">
                  <TabsTrigger value="profile" className="flex items-center gap-2 text-slate-700 ">
                    <LuUser className="h-4 w-4" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex items-center gap-2 text-slate-700">
                    <LuHistory className="h-4 w-4" />
                    Activity
                  </TabsTrigger>
                  {user?.role === "ADMIN" && (
                    <TabsTrigger value="flat" className="flex items-center gap-2 text-slate-700">
                      <LuSettings className="h-4 w-4" />
                      Flat Settings
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name" className="text-white">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                    onClick={() => updateProfileMutation.mutate({ name, email })}
                    disabled={updateProfileMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                    {activities?.map((activity: any) => (
                      <div
                        key={activity._id}
                        className="p-4 rounded-lg border bg-card text-card-foreground"
                      >
                        <p className="font-medium">{activity.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {user?.role === "ADMIN" && (
                  <TabsContent value="flat" className="mt-4 p-6 bg-white rounded-lg shadow-md">
                    <div className="space-y-6">
                      <h3 className="text-2xl font-semibold text-black">Flat Settings</h3>
                      <div className="flex items-center space-x-4">
                        <Label className="text-black font-bold">Flat Username:</Label>
                        <p className="text-sm font-semibold text-indigo-600">{user?.flatUsername}</p>
                      </div>
                    </div>
                  </TabsContent>

                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
