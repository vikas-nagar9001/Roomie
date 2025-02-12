import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiUsers, FiList, FiLogOut, FiUser, FiCreditCard } from "react-icons/fi"; // Updated Icons
import { Link } from "wouter";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="min-h-screen w-full p-6 bg-gradient-to-br from-gray-50 to-gray-200 flex flex-col">
      <div className="w-full flex-grow bg-white shadow-xl rounded-xl p-6 md:p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Welcome, {user?.name} 👋</h1>
          <div className="flex gap-3 mt-4 md:mt-0">
            <Link href="/profile">
              <Button variant="outline" className="flex items-center gap-2 px-5 py-2 border-gray-300 shadow-sm hover:bg-gray-100">
                <FiUser className="h-5 w-5 text-blue-600" /> Profile
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 border-gray-300 shadow-sm hover:bg-red-50 hover:border-red-500"
            >
              <FiLogOut className="h-5 w-5 text-red-600" /> Logout
            </Button>
          </div>
        </div>

        {/* Cards Section */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/entries">
            <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer border border-gray-200 rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg font-medium">
                  <FiList className="h-6 w-6 text-indigo-600 group-hover:text-indigo-800 transition-colors" />
                  Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">View and manage your flat's entries</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/payments">
            <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer border border-gray-200 rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg font-medium">
                  <FiCreditCard className="h-6 w-6 text-green-600 group-hover:text-green-800 transition-colors" />
                  Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Manage bills and track payments</p>
              </CardContent>
            </Card>
          </Link>

          {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
            <Link href="/manage-users">
              <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer border border-gray-200 rounded-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg font-medium">
                    <FiUsers className="h-6 w-6 text-red-600 group-hover:text-red-800 transition-colors" />
                    Manage Users
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
