import { Button } from "@/components/ui/button";
import { FiUser, FiBell } from "react-icons/fi";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
const Logo = "/static/images/Roomie.png";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const { data: activities = [] as Activity[] } = useQuery<Activity[]>({
    queryKey: ["/api/user/activities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/activities");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = activities.filter((a) => !a.read).length;

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-[#0f0f1f] p-3 ">
      <div className={`flex justify-between items-center ${location !== '/' ? 'pl-4 pr-4 pt-3' : 'pl-1 pr-1 pt-3'}`}>
        <Link to="/" className="flex items-center gap-3">
          <img src={Logo} alt="Logo" className="h-16 w-24" />
        </Link>

        <div className="flex items-center gap-8">
          {/* Notification Bell with Badge - hidden on mobile, visible on sm+ */}
          <div className="relative hidden sm:flex items-center justify-center">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative flex items-center justify-center cursor-pointer focus:outline-none"
                >
                  <FiBell className="w-6 h-6 text-white/80 hover:text-[#ab6cff] transition" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#0f0f1f] shadow-md">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-80 bg-[#151525] border border-white/10 text-white shadow-xl rounded-xl p-0"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <FiBell className="w-4 h-4 text-[#ab6cff]" />
                    <span className="text-sm font-semibold">Notifications</span>
                  </div>
                  <Link href="/notifications">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-white/70 hover:text-white">
                      View all
                    </Button>
                  </Link>
                </div>
                <ScrollArea className="max-h-80">
                  {activities.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-white/50">
                      No notifications yet. You&apos;re all caught up!
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {activities.slice(0, 6).map((activity) => {
                        const d = new Date(activity.timestamp);
                        const timeAgo = formatDistanceToNow(d, { addSuffix: true });
                        let label = "Update";
                        let tone = "text-white/80";
                        if (activity.type.startsWith("ENTRY_")) {
                          label = "Entry";
                          tone = "text-emerald-300";
                        } else if (activity.type.startsWith("PAYMENT_")) {
                          label = "Payment";
                          tone = "text-[#ab6cff]";
                        } else if (activity.type.startsWith("PENALTY_")) {
                          label = "Penalty";
                          tone = "text-amber-300";
                        } else if (activity.type === "LOGIN") {
                          label = "Login";
                          tone = "text-sky-300";
                        }
                        return (
                          <li key={activity._id} className="px-4 py-3 text-xs">
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-semibold ${tone}`}
                              >
                                {label[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white/80 text-xs leading-snug line-clamp-2">
                                  {activity.description}
                                </p>
                                <p className="mt-1 text-[11px] text-white/40">{timeAgo}</p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

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
