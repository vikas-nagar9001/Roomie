import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/user-table";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import { LuUserPlus } from "react-icons/lu";
import { Input } from "@/components/ui/input";
import { FiUsers, FiList, FiLogOut, FiUser, FiCreditCard } from "react-icons/fi";
import { Link } from "wouter";
import favicon from "../../favroomie.png";


export default function ManageUsers() {
  const { user} = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (user?.role !== "ADMIN" && user?.role !== "CO_ADMIN") {
    return null;
  }

  return (
    <>

      {/* Header Section  */}
      <div className="bg-gradient-to-r from-slate-900 via-[#241e95] to-indigo-800 p-6 shadow-lg flex justify-between items-center">
        {/* Logo and Profile Button (Logo on the left, Profile Button on the right) */}
        <div className="flex items-center gap-4 w-full">
          {/* Roomie Logo */}
          <div className="flex items-center gap-3">
            <img src={favicon} alt="Roomie Logo" className="h-12" /> {/* Adjust the path accordingly */}
            <h1 className="text-3xl font-bold text-white">Roomie</h1>
          </div>

          {/* Profile Button (aligned to the right on desktop) */}
          <div className="ml-auto">
            <Link href="/profile">
              <Button className="flex items-center gap-2 px-5 py-2 bg-white text-indigo-600 font-semibold rounded-lg shadow-md hover:bg-indigo-50 transition-all">
                <FiUser className="h-5 w-5 text-indigo-600" />
                {user?.name ? user.name.split(" ")[0] : "Profile"}
              </Button>
            </Link>
          </div>
        </div>
      </div>


      <div className="min-h-screen p-6 sm:p-8 bg-gray-100">
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
        </div>
      </div>
    </>
  );
}
