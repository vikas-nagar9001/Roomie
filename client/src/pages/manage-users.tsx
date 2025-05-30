import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/user-table";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import { LuUserPlus } from "react-icons/lu";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";

export default function ManageUsers() {
  const { user } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (user?.role !== "ADMIN" && user?.role !== "CO_ADMIN") {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen p-6 sm:p-8 sm:pt-32 pt-32 bg-gradient-to-r from-indigo-600 via-[#241e95] to-indigo-800">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Section */}
          <div className="rounded-lg bg-gradient-to-r from-slate-900 via-[#241e95] to-indigo-100 p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Manage Users
            </h1>

            <div className="flex items-center gap-4">
              {/* Search Bar */}
              <div className="relative w-full max-w-xs">
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Invite Button */}
              <Button
                onClick={() => setIsInviteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
              >
                <LuUserPlus className="h-5 w-5" />
                <span>Invite User</span>
              </Button>
            </div>
          </div>

          {/* User Table */}
          <UserTable search={search} />

          {/* Invite Dialog */}
          <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />

          {/* Mobile Navigation */}
          <div className="block md:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </>
  );
}
