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

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  
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

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to RoomieBuddy</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register as Admin</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" {...loginForm.register("email")} />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" {...loginForm.register("password")} />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      Login
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" {...registerForm.register("name")} />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" {...registerForm.register("email")} />
                    </div>
                    <div>
                      <Label htmlFor="flatUsername">Flat Username</Label>
                      <Input id="flatUsername" {...registerForm.register("flatUsername")} />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        {...registerForm.register("password")}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
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

      <div className="hidden md:flex flex-col justify-center p-8 bg-primary text-primary-foreground">
        <div className="max-w-md mx-auto space-y-6">
          <LuBuilding2 className="w-16 h-16" />
          <h1 className="text-4xl font-bold">Manage Your Flat Share Effortlessly</h1>
          <p className="text-lg opacity-90">
            Create or join a flat, manage roommates, and keep everything organized
            in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
