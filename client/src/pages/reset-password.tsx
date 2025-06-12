import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showSuccess, showError } from "@/services/toastService";
import { Eye, EyeOff } from "lucide-react";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  
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
  const token = new URLSearchParams(window.location.search).get("token");    const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      showLoader();
      try {
        const res = await apiRequest("POST", "/api/reset-password", data);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: () => {
      showSuccess("You can now log in with your new password");
      hideLoader();
      setLocation("/auth");
    },
    onError: (error: Error) => {
      showError(error.message);
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
              This password reset link is invalid or has expired. Please request a new password reset.
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
          <CardTitle className="text-white">Reset Your Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resetPasswordMutation.mutate({ token, password });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                className="bg-transparent"
                placeholder="Enter your new password"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full flex items-center gap-2 px-4 py-2 bg-[#582c84] hover:bg-[#542d87]  text-white rounded-lg shadow-md transition"
              disabled={resetPasswordMutation.isPending}
            >
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
