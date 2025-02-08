import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LuUsers, LuLogOut, LuUser } from "react-icons/lu";
import { Link } from "wouter";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
          <div className="flex gap-2">
            <Link href="/profile">
              <Button variant="outline">
                <LuUser className="mr-2 h-4 w-4" />
                Profile
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LuLogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/entries">
            <Card className="hover:bg-accent cursor-pointer transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LuList className="h-5 w-5" />
                  Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View and manage your flat's entries
                </p>
              </CardContent>
            </Card>
          </Link>
          {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
            <Link href="/manage-users">
              <Card className="hover:bg-accent cursor-pointer transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LuUsers className="h-5 w-5" />
                    Manage Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Invite new users, manage roles, and handle user access
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}