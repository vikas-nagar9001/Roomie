import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Redirect } from "wouter";
import { LuBuilding2 } from "react-icons/lu";
import { FiUsers, FiList, FiCreditCard } from "react-icons/fi";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const loginForm = useForm({
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      flatUsername: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest("POST", "/api/forgot-password", { email });
    },
    onSuccess: () => {
      toast({
        title: "Reset link sent",
        description: "Check your email for password reset instructions",
      });
      setForgotPasswordOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send reset link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1f] relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-br from-[#5433a7]/20 to-[#6636a3]/10 blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-[70%] h-[40vh] bg-gradient-to-tl from-indigo-500/10 to-purple-500/5 blur-3xl"></div>
      
      <div className="grid md:grid-cols-2 gap-8 max-w-6xl w-full p-4 md:p-8 relative z-10">
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(101,58,167,0.3)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold text-white">Welcome to Roomie</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#1a1a2e] mb-6">
                  <TabsTrigger 
                    value="login" 
                    className="data-[state=active]:bg-[#6636a3] data-[state=active]:text-white text-gray-300"
                  >
                    Login
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register" 
                    className="data-[state=active]:bg-[#6636a3] data-[state=active]:text-white text-gray-300"
                  >
                    Register as Admin
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email" className="text-gray-300">Email</Label>
                        <Input 
                          id="email" 
                          {...loginForm.register("email")} 
                          className="bg-[#1a1a2e] border-[#6636a3]/50 focus:border-[#6636a3] text-white"
                          placeholder="Enter your email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password" className="text-gray-300">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showLoginPassword ? "text" : "password"}
                            {...loginForm.register("password")}
                            className="bg-[#1a1a2e] border-[#6636a3]/50 focus:border-[#6636a3] text-white"
                            placeholder="Enter your password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-gray-400 hover:text-white"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                          >
                            {showLoginPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full relative group overflow-hidden rounded-lg"
                        disabled={loginMutation.isPending}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#5433a7] to-[#6636a3] group-hover:scale-105 transition-transform duration-300"></div>
                        <span className="relative z-10 flex items-center justify-center gap-2 text-white font-medium">
                          Login
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        className="w-full text-indigo-300 hover:text-indigo-200"
                        onClick={() => setForgotPasswordOpen(true)}
                      >
                        Forgot Password?
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                        <Input 
                          id="name" 
                          {...registerForm.register("name")} 
                          className="bg-[#1a1a2e] border-[#6636a3]/50 focus:border-[#6636a3] text-white"
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-gray-300">Email</Label>
                        <Input 
                          id="email" 
                          {...registerForm.register("email")} 
                          className="bg-[#1a1a2e] border-[#6636a3]/50 focus:border-[#6636a3] text-white"
                          placeholder="Enter your email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="flatUsername" className="text-gray-300">Flat Username</Label>
                        <Input 
                          id="flatUsername" 
                          {...registerForm.register("flatUsername")} 
                          className="bg-[#1a1a2e] border-[#6636a3]/50 focus:border-[#6636a3] text-white"
                          placeholder="Enter your flat username"
                        />
                      </div>
                      <div>
                        <Label htmlFor="registerPassword" className="text-gray-300">Password</Label>
                        <div className="relative">
                          <Input
                            id="registerPassword"
                            type={showRegisterPassword ? "text" : "password"}
                            {...registerForm.register("password")}
                            className="bg-[#1a1a2e] border-[#6636a3]/50 focus:border-[#6636a3] text-white"
                            placeholder="Create a strong password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-gray-400 hover:text-white"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          >
                            {showRegisterPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full relative group overflow-hidden rounded-lg"
                        disabled={registerMutation.isPending}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#5433a7] to-[#6636a3] group-hover:scale-105 transition-transform duration-300"></div>
                        <span className="relative z-10 flex items-center justify-center gap-2 text-white font-medium">
                          Create Account
                        </span>
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="hidden md:flex flex-col justify-center p-8 relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] to-[#6636a3] rounded-2xl blur opacity-75"></div>
          <div className="relative bg-black/50 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-[0_0_30px_rgba(101,58,167,0.3)]">
            <LuBuilding2 className="w-16 h-16 text-indigo-300 mb-6" />
            <h1 className="text-4xl font-bold text-white mb-4">Manage Your Flat Share Effortlessly</h1>
            <p className="text-lg text-indigo-200/90">
              Create or join a flat, manage roommates, and keep everything organized
              in one place.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#6636a3]/30 flex items-center justify-center">
                  <FiUsers className="w-5 h-5 text-indigo-300" />
                </div>
                <p className="text-indigo-100">Manage roommates and permissions</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#6636a3]/30 flex items-center justify-center">
                  <FiList className="w-5 h-5 text-indigo-300" />
                </div>
                <p className="text-indigo-100">Track expenses and payments</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#6636a3]/30 flex items-center justify-center">
                  <FiCreditCard className="w-5 h-5 text-indigo-300" />
                </div>
                <p className="text-indigo-100">Simplify bill splitting and settlements</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="max-w-md w-full p-6 rounded-xl shadow-lg bg-black/40 backdrop-blur-xl border border-[#6636a3]/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">Reset Password</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              forgotPasswordMutation.mutate(resetEmail);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="resetEmail" className="text-gray-300 font-medium">Email</Label>
              <Input
                id="resetEmail"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="bg-[#1a1a2e] border-[#6636a3]/50 focus:border-[#6636a3] text-white"
              />
            </div>
            <Button
              type="submit"
              className="w-full relative group overflow-hidden rounded-lg"
              disabled={forgotPasswordMutation.isPending}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#5433a7] to-[#6636a3] group-hover:scale-105 transition-transform duration-300"></div>
              <span className="relative z-10 flex items-center justify-center gap-2 text-white font-medium">
                Send Reset Link
              </span>
            </Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}