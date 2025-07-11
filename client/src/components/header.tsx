import { Button } from "@/components/ui/button";
import { FiUser, FiBell } from "react-icons/fi";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
const Logo = "/static/images/Roomie.png";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const getInitials = (name: string | undefined) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export function Header() {
  const { user } = useAuth();
  const [location] = useLocation();

  // Replace with your actual unread notification count
  const unreadCount = 3;

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-[#0f0f1f] p-3 ">
      <div className={`flex justify-between items-center ${location !== '/' ? 'pl-4 pr-4 pt-3' : 'pl-1 pr-1 pt-3'}`}>
        <Link to="/" className="flex items-center gap-3">
          <img src={Logo} alt="Logo" className="h-16 w-24" />
        </Link>

        <div className="flex items-center gap-8">
          {/* Notification Bell with Badge - hidden on mobile, visible on sm+ */}
          <Link to="">
            <div className="relative hidden sm:flex items-center justify-center cursor-pointer">
              <FiBell className="w-6 h-6 text-white/80 hover:text-[#ab6cff] transition" />
              {unreadCount > 0 && (
                <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#0f0f1f] shadow-md">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </Link>

          <Link href="/profile">
            <div className="relative group cursor-pointer">
              <div className="p-[2px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 ring-2 ring-white/30 group-hover:ring-white/50 transition-all shadow-xl">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={user?.profilePicture} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute top-0 left-0 w-full h-full bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
