import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiUsers, FiList, FiUser, FiCreditCard, FiAlertTriangle } from "react-icons/fi";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { Header } from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";

export default function Dashboard() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("");
  const [location] = useLocation();

  // Show loader when the page first loads
  useEffect(() => {
    showLoader();
    
    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);
  // Fetch entries data
  const { data: entries, isLoading: entriesLoading } = useQuery<any[]>({
    queryKey: ["/api/entries"],
  });
  
  // Hide loader when data is loaded
  useEffect(() => {
    if (!entriesLoading && entries) {
      // Use a small timeout to ensure a consistent loader experience across the app
      setTimeout(() => {
        hideLoader();
      }, 300);
    }
  }, [entriesLoading, entries]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // Mobile View Component
  const MobileView = () => (
    <div className="pt-[110px] pb-20 min-h-screen bg-[#0f0f1f]">
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
              <div className="absolute inset-0 bg-[#582c84] duration-300 group-hover:scale-105"></div>
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
              <div className="absolute inset-0 bg-[#582c84] duration-300 group-hover:scale-105"></div>
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
              <div className="absolute inset-0 bg-[#582c84] duration-300 group-hover:scale-105"></div>
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
                <div className="absolute inset-0 bg-[#582c84] transition-all duration-300 group-hover:scale-105"></div>
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
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-[#0f0f1f] blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[70%] h-[40vh] bg-gradient-to-tl from-indigo-500/10 to-purple-500/5 blur-3xl"></div>

        {/* Main Content */}
        <div className="relative z-10 container mx-auto max-w-7xl px-6 py-12">
          {/* Welcome Section */}
          <div className="mb-12">
            <h2 className="text-xl text-indigo-300/80 font-medium mb-2">{greeting},</h2>
            <h1 className="text-4xl font-bold text-white tracking-tight">{user?.name?.split(" ")[0]} <span className="inline-block animate-wave">👋</span></h1>
          </div>

          {/* Cards Section */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/entries">
              <div className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(101,58,167,0.3)] hover:translate-y-[-5px]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5433a7] to-[#582c84] opacity-90"></div>
                <div className="absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-10"></div>
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
                <div className="relative p-6 h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-semibold text-white mb-2">Entries</h3>
                    <div className="p-2 bg-white/10 backdrop-blur-xl rounded-full">
                      <FiList className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-indigo-100/80 mt-2">View and manage your flat's entries</p>
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <span className="text-sm text-white/70 flex items-center group-hover:text-white">
                      View Details
                      <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/payments">
              <div className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(101,58,167,0.3)] hover:translate-y-[-5px]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5433a7] to-[#582c84] opacity-90"></div>
                <div className="absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-10"></div>
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
                <div className="relative p-6 h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-semibold text-white mb-2">Payments</h3>
                    <div className="p-2 bg-white/10 backdrop-blur-xl rounded-full">
                      <FiCreditCard className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-indigo-100/80 mt-2">Manage bills and track payments</p>
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <span className="text-sm text-white/70 flex items-center group-hover:text-white">
                      View Details
                      <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link href="/penalties">
              <div className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(101,58,167,0.3)] hover:translate-y-[-5px]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5433a7] to-[#582c84] opacity-90"></div>
                <div className="absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-10"></div>
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
                <div className="relative p-6 h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-semibold text-white mb-2">Penalties</h3>
                    <div className="p-2 bg-white/10 backdrop-blur-xl rounded-full">
                      <FiAlertTriangle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-indigo-100/80 mt-2">Manage and track user penalties</p>
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <span className="text-sm text-white/70 flex items-center group-hover:text-white">
                      View Details
                      <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
              <Link href="/manage-users">
                <div className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(101,58,167,0.3)] hover:translate-y-[-5px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#5433a7] to-[#582c84] opacity-90"></div>
                  <div className="absolute inset-0 bg-[url('/subtle-pattern.png')] opacity-10"></div>
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
                  <div className="relative p-6 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-semibold text-white mb-2">Manage Users</h3>
                      <div className="p-2 bg-white/10 backdrop-blur-xl rounded-full">
                        <FiUsers className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-indigo-100/80 mt-2">Invite new users, manage roles, and handle user access</p>
                    <div className="mt-6 pt-4 border-t border-white/10">
                      <span className="text-sm text-white/70 flex items-center group-hover:text-white">
                        View Details
                        <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
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