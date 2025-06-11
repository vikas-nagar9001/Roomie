import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/user-table";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import { LuUserPlus } from "react-icons/lu";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";

export default function ManageUsers() {
  const { user } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Show loader when the page is first loaded
  useEffect(() => {
    if (initialLoad) {
      showLoader();
    }
    
    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, [initialLoad]);

  if (user?.role !== "ADMIN" && user?.role !== "CO_ADMIN") {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen p-8 pt-28 bg-[#0f0f1f]">
        <div className="max-w-7xl mx-auto">
          <div className="relative group mb-8">
            {/* Blurred border layer */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>

            {/* Main content */}
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10 flex flex-wrap justify-between items-center gap-4">
              <h1 className="text-2xl sm:text-3xl text-white font-bold">Manage Users</h1>

              <div className="flex items-center gap-4">
                {/* Search Bar */}
                <div className="relative w-full max-w-xs">
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                  />
                </div>

                {/* Invite Button */}
                <Button
                  onClick={() => setIsInviteOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg shadow-md transition"
                >
                  <LuUserPlus className="h-5 w-5" />
                  <span>Invite User</span>
                </Button>
              </div>
            </div>
          </div>          {/* User Table */}
          <UserTable 
            search={search} 
            onLoadComplete={() => setInitialLoad(false)}
          />

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
