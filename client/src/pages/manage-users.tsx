import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/user-table";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import { LuUserPlus } from "react-icons/lu";
import { Input } from "@/components/ui/input";

export default function ManageUsers() {
  const { user } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (user?.role !== "ADMIN" && user?.role !== "CO_ADMIN") {
    return null;
  }

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-gray-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Manage Users
          </h1>
          <Button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
          >
            <LuUserPlus className="h-5 w-5" />
            <span>Invite User</span>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center w-full max-w-lg">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* User Table */}
        <UserTable search={search} />

        {/* Invite Dialog */}
        <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      </div>
    </div>
  );
}
