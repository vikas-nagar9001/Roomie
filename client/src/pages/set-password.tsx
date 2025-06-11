import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Show loader when page loads
  useEffect(() => {
    // Hide any existing loaders first
    hideLoader();
    // Then show the loader
    showLoader();
    
    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);
  
  // Get token from URL
  const token = new URLSearchParams(window.location.search).get("token");
  const setPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      showLoader();
      try {
        const res = await apiRequest("POST", "/api/set-password", data);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Password set successfully",
        description: "You can now log in with your email and password",
      });
      hideLoader();
      setLocation("/auth");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to set password",
        description: error.message,
        variant: "destructive",
      });
      hideLoader();
    },
  });
  // Hide loader when there's no token (invalid link)
  useEffect(() => {
    if (!token) {
      hideLoader();
    }
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This password reset link is invalid or has expired. Please request a new invite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f1f] min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-white">Set Your Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPasswordMutation.mutate({ token, password });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                className="bg-transparent"
                placeholder="Set your password"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full flex items-center gap-2 px-4 py-2 bg-[#582c84] hover:bg-[#542d87]  text-white rounded-lg shadow-md transition"
              disabled={setPasswordMutation.isPending}
            >
              Set Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
