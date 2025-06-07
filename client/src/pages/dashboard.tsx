import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiUsers, FiList, FiUser, FiCreditCard, FiAlertTriangle } from "react-icons/fi";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { Header } from "@/components/header";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("");
  const [location] = useLocation();

  // Fetch entries data
  const { data: entries } = useQuery<any[]>({
    queryKey: ["/api/entries"],
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // Mobile View Component
  const MobileView = () => (
    <div className="pt-[100px] min-h-screen bg-[#0f0f1f]">
      {/* Glass Morphism Effect */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[#0f0f1f]"></div>
        <div className="absolute top-0 left-0 right-0 h-96 bg-[#0f0f1f]"></div>
      </div>

      <Header />

      {/* Mobile Main Content */}
      <main className="relative px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-lg text-indigo-200/80">{greeting},</h2>
          <h1 className="text-3xl font-bold text-white tracking-tight">{user?.name?.split(" ")[0]} 👋</h1>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <p className="text-indigo-200/60 text-sm">Total Entries</p>
              <p className="text-2xl font-bold text-white">
                {entries?.filter((e) => {
                  const entryUserId = typeof e.userId === 'object' && e.userId !== null
                    ? (e.userId._id || e.userId.id || e.userId)
                    : e.userId;
                  const userIdStr = entryUserId?.toString();
                  const currentUserIdStr = user?._id?.toString();
                  return userIdStr === currentUserIdStr;
                }).length || 0}
              </p>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <p className="text-indigo-200/60 text-sm">Pending</p>
              <p className="text-2xl font-bold text-white">
                {entries?.filter((e) => {
                  const entryUserId = typeof e.userId === 'object' && e.userId !== null
                    ? (e.userId._id || e.userId.id || e.userId)
                    : e.userId;
                  const userIdStr = entryUserId?.toString();
                  const currentUserIdStr = user?._id?.toString();
                  return userIdStr === currentUserIdStr && e.status === "PENDING";
                }).length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Main Menu Cards */}
        <div className="grid gap-4">
          <Link href="/entries">
            <div className="relative group overflow-hidden rounded-xl">
              <div className="absolute inset-0 bg-[#6636a3] duration-300 group-hover:scale-105"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative p-4 flex items-center justify-between bg-black/20">
                <div>
                  <h3 className="text-lg font-semibold mb-1 text-white">Entries</h3>
                  <p className="text-sm text-indigo-200/80">Manage your flat's entries</p>
                </div>
                <div className="relative">
                  <div className="absolute -inset-1 bg-white/20 rounded-full blur-sm group-hover:bg-white/30 transition-all"></div>
                  <FiList className="relative w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </Link>

          <Link href="/payments">
            <div className="relative group overflow-hidden rounded-xl">
              <div className="absolute inset-0 bg-[#6636a3] duration-300 group-hover:scale-105"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative p-4 flex items-center justify-between bg-black/20">
                <div>
                  <h3 className="text-lg font-semibold mb-1 text-white">Payments</h3>
                  <p className="text-sm text-indigo-200/80">Track bills and payments</p>
                </div>
                <div className="relative">
                  <div className="absolute -inset-1 bg-white/20 rounded-full blur-sm group-hover:bg-white/30 transition-all"></div>
                  <FiCreditCard className="relative w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </Link>

          <Link href="/penalties">
            <div className="relative group overflow-hidden rounded-xl">
              <div className="absolute inset-0 bg-[#6636a3] duration-300 group-hover:scale-105"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative p-4 flex items-center justify-between bg-black/20">
                <div>
                  <h3 className="text-lg font-semibold mb-1 text-white">Penalties</h3>
                  <p className="text-sm text-indigo-200/80">View and manage penalties</p>
                </div>
                <div className="relative">
                  <div className="absolute -inset-1 bg-white/20 rounded-full blur-sm group-hover:bg-white/30 transition-all"></div>
                  <FiAlertTriangle className="relative w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </Link>

          {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
            <Link href="/manage-users">
              <div className="relative group overflow-hidden rounded-xl">
                <div className="absolute inset-0 bg-[#6636a3] transition-all duration-300 group-hover:scale-105"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative p-4 flex items-center justify-between bg-black/20">
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-white">Manage Users</h3>
                    <p className="text-sm text-indigo-200/80">Handle user access and roles</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -inset-1 bg-white/20 rounded-full blur-sm group-hover:bg-white/30 transition-all"></div>
                    <FiUsers className="relative w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        <MobileNav />
      </main>
    </div>
  );

  // Desktop View Component
  const DesktopView = () => (
    <>
      <Header />

      <div className="min-h-screen w-full relative flex flex-col bg-[#0f0f1f] pt-[80px]">
        {/* Background Blur Effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 80%)] opacity-30 blur-2xl"></div>

        <div className="relative z-10 w-full flex-grow bg-[#0f0f1f] shadow-2xl p-6 md:p-8">
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
