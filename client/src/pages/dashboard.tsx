import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiUsers, FiList, FiLogOut, FiUser, FiCreditCard, FiAlertTriangle } from "react-icons/fi";
import { Link } from "wouter";
import favicon from "../../favroomie.png";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();

  return (
    <>
      {/* Header Section  */}
      <div className="bg-gradient-to-r from-slate-900 via-[#241e95] to-indigo-800 p-6 shadow-lg flex flex-col md:flex-row justify-between items-center">
        {/* Logo */}
        <a href="/">
          <div className="flex items-center gap-3">
            <img src={favicon} alt="Roomie Logo" className="h-12" /> {/* Adjust the path accordingly */}
            <h1 className="text-3xl font-bold text-white">Roomie</h1>
          </div>
          </a>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link href="/profile">
            <Button className="flex items-center gap-2 px-5 py-2 bg-white text-indigo-600 font-semibold rounded-lg shadow-md hover:bg-indigo-50 transition-all">
              <FiUser className="h-5 w-5 text-indigo-600" />
              {user?.name ? user.name.split(" ")[0] : "Profile"}
            </Button>
          </Link>

          <Button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all"
          >
            <FiLogOut className="h-5 w-5 text-white" />
            Logout
          </Button>
        </div>
      </div>


      <div className="min-h-screen w-full relative flex flex-col bg-white ">

        {/* Background Blur Effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 80%)] opacity-30 blur-2xl"></div>

        <div className="relative z-10 w-full flex-grow bg-gradient-to-r from-indigo-600  via-[#241e95]  to-indigo-800 shadow-2xl p-6 md:p-8">


          {/* Welcome Message */}
          {/* <h1 className="text-3xl font-bold text-white">
            Welcome, {user?.name} 👋
          </h1>
          <br /> */}


          {/* Cards Section */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/entries">
              <Card className="group hover:shadow-xl hover:scale-[1.05] transition-all cursor-pointer border border-gray-200 rounded-xl bg-white/80 backdrop-blur-md">
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
              <Card className="group hover:shadow-xl hover:scale-[1.05] transition-all cursor-pointer border border-gray-200 rounded-xl bg-white/80 backdrop-blur-md">
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
            
            <Link href="/penalties">
              <Card className="group hover:shadow-xl hover:scale-[1.05] transition-all cursor-pointer border border-gray-200 rounded-xl bg-white/80 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg font-medium">
                    <FiAlertTriangle className="h-6 w-6 text-red-600 group-hover:text-red-800 transition-colors" />
                    Penalties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Manage and track user penalties</p>
                </CardContent>
              </Card>
            </Link>

            {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
              <Link href="/manage-users">
                <Card className="group hover:shadow-xl hover:scale-[1.05] transition-all cursor-pointer border border-gray-200 rounded-xl bg-white/80 backdrop-blur-md">
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
    </>
  );
}
