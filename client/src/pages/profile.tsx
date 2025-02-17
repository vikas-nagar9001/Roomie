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

export default function ProfilePage() {
  const { user } = useAuth();
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
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg">
            <CardContent className="p-6 flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24 border-2 border-white/50 shadow-md">
                <AvatarImage src={user?.profilePicture || "/default-avatar.png"} />
                <AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Input
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="hidden"
                id="profile-picture"
              />
              <Button
                variant="outline"
                className="w-full border-white/30 bg-indigo-500 hover:bg-white/20 text-white transition"
                onClick={() => document.getElementById("profile-picture")?.click()}
              >
                Change Picture
              </Button>
              <p className="text-lg font-semibold">{user?.name}</p>
              <p className="text-sm opacity-80 font-semibold">{user?.email}</p>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg">
            <CardContent className="p-6">
              <Tabs defaultValue="profile">
                <TabsList className="grid w-full grid-cols-3 bg-indigo-500 p-1 rounded-lg">
                  <TabsTrigger value="profile" className="flex items-center gap-2 px-4 py-2 text-white hover:bg-white/20 rounded-lg transition">
                    <LuUser className="h-5 w-5" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex items-center gap-2 px-4 py-2 text-white hover:bg-white/20 rounded-lg transition">
                    <LuHistory className="h-5 w-5" />
                    Activity
                  </TabsTrigger>
                  {user?.role === "ADMIN" && (
                    <TabsTrigger value="flat" className="flex items-center gap-2 px-4 py-2 text-white hover:bg-white/20 rounded-lg transition">
                      <LuSettings className="h-5 w-5" />
                      Flat Settings
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-black"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-black"
                    />
                  </div>
                  <Button
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                    onClick={() => updateProfileMutation.mutate({ name, email })}
                    disabled={updateProfileMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Recent Activity</h3>
                    {activities?.map((activity: any) => (
                      <div key={activity._id} className="p-4 rounded-lg border border-white/30 bg-white/10">
                        <p className="font-medium">{activity.description}</p>
                        <p className="text-sm opacity-80">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {user?.role === "ADMIN" && (
                  <TabsContent value="flat" className="mt-4">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Flat Settings</h3>
                      <div>
                        <Label>Flat Username</Label>
                        <p className="text-sm opacity-80">{user?.flatUsername}</p>
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
