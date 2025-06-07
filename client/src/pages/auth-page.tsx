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

  // Mobile View Component
  const MobileView = () => (
    <div className="min-h-screen bg-[#0f0f1f] p-4 flex flex-col justify-center">
      {/* Glass Morphism Effect */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[#0f0f1f]"></div>
        <div className="absolute top-0 left-0 right-0 h-96 bg-[#0f0f1f]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <LuBuilding2 className="w-16 h-16 mx-auto text-indigo-400" />
          <h1 className="text-3xl font-bold text-white mt-4">Roomie</h1>
          <p className="text-indigo-200/80 mt-2">Manage Your Flat Share Effortlessly</p>
        </div>
        
        <div className="relative group mb-6">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] to-[#6636a3] rounded-xl opacity-15"></div>
          <Card className="relative bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
            <CardContent className="p-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-black/30 mb-6">
                  <TabsTrigger value="login" className="text-white data-[state=active]:bg-[#6636a3] data-[state=active]:text-white">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="register" className="text-white data-[state=active]:bg-[#6636a3] data-[state=active]:text-white">
                    Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email" className="text-indigo-200">Email</Label>
                        <Input 
                          id="email" 
                          placeholder="Enter your email"
                          {...loginForm.register("email")} 
                          className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password" className="text-indigo-200">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            placeholder="Enter your password"
                            type={showLoginPassword ? "text" : "password"}
                            {...loginForm.register("password")}
                            className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-indigo-200"
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
                        className="w-full bg-gradient-to-r from-[#5433a7] to-[#6636a3] hover:opacity-90 text-white border-none"
                        disabled={loginMutation.isPending}
                      >
                        Login
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        className="w-full text-indigo-300"
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
                        <Label htmlFor="name" className="text-indigo-200">Full Name</Label>
                        <Input 
                          id="name" 
                          placeholder="Enter your full name"
                          {...registerForm.register("name")} 
                          className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-indigo-200">Email</Label>
                        <Input 
                          id="email" 
                          placeholder="Enter your email"
                          {...registerForm.register("email")} 
                          className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="flatUsername" className="text-indigo-200">Flat Username</Label>
                        <Input 
                          id="flatUsername" 
                          placeholder="Enter your flat username"
                          {...registerForm.register("flatUsername")} 
                          className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="registerPassword" className="text-indigo-200">Password</Label>
                        <div className="relative">
                          <Input
                            id="registerPassword"
                            placeholder="Create a password"
                            type={showRegisterPassword ? "text" : "password"}
                            {...registerForm.register("password")}
                            className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-indigo-200"
                            onClick={(e) => {
                              e.stopPropagation(); // इवेंट को बुबल होने से रोकें
                              setShowRegisterPassword(!showRegisterPassword);
                            }}
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
                        className="w-full bg-gradient-to-r from-[#5433a7] to-[#6636a3] hover:opacity-90 text-white border-none"
                        disabled={registerMutation.isPending}
                      >
                        Create Account
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  // Desktop View Component
  const DesktopView = () => (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#0f0f1f]">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <LuBuilding2 className="w-8 h-8 text-indigo-400" />
              <CardTitle className="text-white">Welcome to Roomie</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 bg-black/30 mb-6">
                <TabsTrigger value="login" className="text-white data-[state=active]:bg-[#6636a3] data-[state=active]:text-white">
                  Login
                </TabsTrigger>
                <TabsTrigger value="register" className="text-white data-[state=active]:bg-[#6636a3] data-[state=active]:text-white">
                  Register as Admin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email" className="text-indigo-200">Email</Label>
                      <Input 
                        id="email" 
                        placeholder="Enter your email"
                        {...loginForm.register("email")} 
                        className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-indigo-200">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          placeholder="Enter your password"
                          type={showLoginPassword ? "text" : "password"}
                          {...loginForm.register("password")}
                          className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-indigo-200"
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
                      className="w-full bg-gradient-to-r from-[#5433a7] to-[#6636a3] hover:opacity-90 text-white border-none"
                      disabled={loginMutation.isPending}
                    >
                      Login
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-indigo-300"
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
                      <Label htmlFor="name" className="text-indigo-200">Full Name</Label>
                      <Input 
                        id="name" 
                        placeholder="Enter your full name"
                        {...registerForm.register("name")} 
                        className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-indigo-200">Email</Label>
                      <Input 
                        id="email" 
                        placeholder="Enter your email"
                        {...registerForm.register("email")} 
                        className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="flatUsername" className="text-indigo-200">Flat Username</Label>
                      <Input 
                        id="flatUsername" 
                        placeholder="Enter your flat username"
                        {...registerForm.register("flatUsername")} 
                        className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="registerPassword" className="text-indigo-200">Password</Label>
                      <div className="relative">
                        <Input
                          id="registerPassword"
                          placeholder="Create a password"
                          type={showRegisterPassword ? "text" : "password"}
                          {...registerForm.register("password")}
                          className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-indigo-200"
                          onClick={(e) => {
                            e.stopPropagation(); // इवेंट को बुबल होने से रोकें
                            setShowRegisterPassword(!showRegisterPassword);
                          }}
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
                      className="w-full bg-gradient-to-r from-[#5433a7] to-[#6636a3] hover:opacity-90 text-white border-none"
                      disabled={registerMutation.isPending}
                    >
                      Create Account
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="hidden md:flex flex-col justify-center p-8 bg-gradient-to-br from-[#5433a7] to-[#6636a3] text-white">
        <div className="max-w-md mx-auto space-y-6">
          <LuBuilding2 className="w-16 h-16" />
          <h1 className="text-4xl font-bold">Manage Your Flat Share Effortlessly</h1>
          <p className="text-lg opacity-90">
            Create or join a flat, manage roommates, and keep everything organized
            in one place.
          </p>
        </div>
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="max-w-md w-full p-6 rounded-xl shadow-lg bg-[#0f0f1f] border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Reset Password</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              forgotPasswordMutation.mutate(resetEmail);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="resetEmail" className="text-indigo-200 font-medium">Email</Label>
              <Input
                id="resetEmail"
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="bg-black/30 border-white/20 text-white focus:border-indigo-500"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#5433a7] to-[#6636a3] hover:opacity-90 text-white border-none"
              disabled={forgotPasswordMutation.isPending}
            >
              Send Reset Link
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <>
      {/* Show Mobile View for screens smaller than md breakpoint */}
      <div className="block md:hidden">
        <MobileView />
      </div>

      {/* Show Desktop View for md and larger screens */}
      <div className="hidden md:block">
        <DesktopView />
      </div>
    </>
  );
}