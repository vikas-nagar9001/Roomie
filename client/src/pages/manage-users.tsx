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
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <h1 className="text-3xl font-bold">Manage Users</h1>
          <Button onClick={() => setIsInviteOpen(true)}>
            <LuUserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <UserTable search={search} />
        <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      </div>
    </div>
  );
}
