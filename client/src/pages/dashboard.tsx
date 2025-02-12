import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LuUsers, LuList, LuLogOut, LuUser, LuWallet } from "react-icons/lu";
import { Link } from "wouter";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="min-h-screen w-full p-4 bg-gray-100 flex flex-col">
      <div className="w-full flex-grow bg-white shadow-lg rounded-none p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">Welcome, {user?.name}</h1>
          <div className="flex gap-3 mt-4 md:mt-0">
            <Link href="/profile">
              <Button variant="outline" className="flex items-center gap-2 px-4 py-2">
                <LuUser className="h-5 w-5" /> Profile
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-2 px-4 py-2"
            >
              <LuLogOut className="h-5 w-5" /> Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/entries">
            <Card className="hover:bg-gray-50 transition-all cursor-pointer shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                  <LuList className="h-5 w-5 text-indigo-600" /> Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">View and manage your flat's entries</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/payments">
            <Card className="hover:bg-gray-50 transition-all cursor-pointer shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                  <LuWallet className="h-5 w-5 text-green-600" /> Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Manage bills and track payments</p>
              </CardContent>
            </Card>
          </Link>

          {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
            <Link href="/manage-users">
              <Card className="hover:bg-gray-50 transition-all cursor-pointer shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-medium">
                    <LuUsers className="h-5 w-5 text-red-600" /> Manage Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Invite new users, manage roles, and handle user access</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
