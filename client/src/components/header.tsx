import { Button } from "@/components/ui/button";
import { FiUser, FiBell, FiCheck, FiCheckCircle, FiList, FiCreditCard, FiAlertTriangle, FiLogIn, FiSettings, FiClock } from "react-icons/fi";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
const Logo = "/static/images/Roomie.png";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const getInitials = (name: string | undefined) => {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase();
};

function getPopupMeta(type: string) {
  if (type.startsWith("ENTRY_"))   return { icon: FiList,          color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Entry",   dot: "bg-emerald-400" };
  if (type.startsWith("PAYMENT_")) return { icon: FiCreditCard,    color: "text-[#c49bff]",   bg: "bg-[#7c3fbf]/20",  label: "Payment", dot: "bg-[#ab6cff]" };
  if (type.startsWith("PENALTY_")) return { icon: FiAlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/15",  label: "Penalty", dot: "bg-amber-400" };
  if (type === "LOGIN")             return { icon: FiLogIn,         color: "text-sky-400",     bg: "bg-sky-500/15",    label: "Login",   dot: "bg-sky-400" };
  return { icon: FiSettings, color: "text-white/50", bg: "bg-white/10", label: "Update", dot: "bg-white/30" };
}

function formatPopupTime(date: Date) {
  if (isToday(date))     return formatDistanceToNow(date, { addSuffix: true });
  if (isYesterday(date)) return "Yesterday · " + format(date, "hh:mm a");
  return format(date, "d MMM · hh:mm a");
}

export function Header() {
  const { user } = useAuth();
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

  // ── PWA App Icon Badge (like WhatsApp) ──────────────────────────────────
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    if (unreadCount > 0) {
      (navigator as any).setAppBadge(unreadCount).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/user/activities/${id}/read`);
      if (!res.ok) throw new Error("Failed");
      return { id };
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/user/activities"] });
      const prev = queryClient.getQueryData<Activity[]>(["/api/user/activities"]);
      queryClient.setQueryData<Activity[]>(["/api/user/activities"], old =>
        old ? old.map(a => a._id === id ? { ...a, read: true } : a) : old
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/user/activities"], ctx.prev);
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/activities/read-all");
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.setQueryData<Activity[]>(["/api/user/activities"], old =>
        old ? old.map(a => ({ ...a, read: true })) : old
      );
    },
  });

  const recent = activities.slice(0, 8);

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-[#0f0f1f]/95 backdrop-blur-md border-b border-white/[0.05]">
      <div className="flex justify-between items-center px-3 pt-2 pb-1">
        {/* Left: logo */}
        <Link to="/" className="flex items-center">
          <img src={Logo} alt="Logo" className="h-16 w-24" />
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* History link — desktop only */}
          <Link href="/history" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/50 hover:text-[#c49bff] hover:bg-[#582c84]/15 border border-transparent hover:border-[#7c3fbf]/25 transition-all text-xs font-medium">
            <FiClock className="w-3.5 h-3.5" />
            History
          </Link>

          {/* Notification Bell — mobile: link to page, desktop: popover */}
          <div className="relative flex items-center justify-center">
            {/* Mobile bell → direct link */}
            <Link href="/notifications" className="relative sm:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] active:bg-[#582c84]/20 transition-all">
              <FiBell className="w-[18px] h-[18px] text-white/70" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-[#0f0f1f] shadow-lg">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Desktop bell → popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-[#582c84]/20 hover:border-[#7c3fbf]/40 transition-all focus:outline-none"
                >
                  <FiBell className="w-[18px] h-[18px] text-white/70 hover:text-[#c49bff] transition" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-[#0f0f1f] shadow-lg">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>

              <PopoverContent
                align="end"
                sideOffset={10}
                className="w-[360px] bg-[#111120] border border-white/[0.08] text-white shadow-2xl rounded-2xl p-0 overflow-hidden"
              >
                {/* Popup header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#0f0f1e]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#582c84]/30 border border-[#7c3fbf]/30 flex items-center justify-center">
                      <FiBell className="w-3 h-3 text-[#c49bff]" />
                    </div>
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="bg-[#7c3fbf] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead.mutate()}
                        title="Mark all read"
                        className="h-7 px-2 text-[10px] text-[#c49bff]/80 hover:text-[#c49bff] hover:bg-[#582c84]/30 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <FiCheckCircle className="w-3 h-3" /> All read
                      </button>
                    )}
                    <Link href="/notifications">
                      <button className="h-7 px-2 text-[10px] text-white/40 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all">
                        View all →
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Notification list */}
                <ScrollArea className="max-h-[360px]">
                  {activities.length === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-2 text-center px-4">
                      <div className="w-10 h-10 rounded-xl bg-[#582c84]/15 border border-[#7c3fbf]/15 flex items-center justify-center">
                        <FiBell className="w-5 h-5 text-white/20" />
                      </div>
                      <p className="text-xs text-white/35">You're all caught up!</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/[0.04]">
                      {recent.map((activity) => {
                        const meta = getPopupMeta(activity.type);
                        const Icon = meta.icon;
                        const d = new Date(activity.timestamp);
                        return (
                          <li
                            key={activity._id}
                            className={cn(
                              "group flex items-start gap-3 px-4 py-3 transition-all border-l-2",
                              activity.read
                                ? "border-l-transparent hover:bg-white/[0.02]"
                                : `border-l-[${meta.dot}] bg-white/[0.02] hover:bg-white/[0.04]`
                            )}
                          >
                            {/* Icon */}
                            <div className={cn("mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                              <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={cn("text-[9px] font-semibold uppercase tracking-wide", meta.color)}>
                                      {meta.label}
                                    </span>
                                    {!activity.read && (
                                      <span className="w-1 h-1 rounded-full bg-[#ab6cff]" />
                                    )}
                                  </div>
                                  <p className={cn(
                                    "text-xs leading-snug line-clamp-2",
                                    activity.read ? "text-white/50" : "text-white/85"
                                  )}>
                                    {activity.description}
                                  </p>
                                  <p className="mt-1 text-[10px] text-white/25">{formatPopupTime(d)}</p>
                                </div>
                                {!activity.read && (
                                  <button
                                    onClick={() => markOneRead.mutate(activity._id)}
                                    title="Mark read"
                                    className="shrink-0 mt-0.5 w-6 h-6 rounded-lg border border-[#7c3fbf]/30 bg-[#582c84]/10 text-[#c49bff] hover:bg-[#582c84]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <FiCheck className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </ScrollArea>

                {activities.length > 8 && (
                  <div className="border-t border-white/[0.06] px-4 py-2.5 bg-[#0f0f1e]">
                    <Link href="/notifications">
                      <button className="w-full text-xs text-white/40 hover:text-[#c49bff] transition-colors text-center">
                        View {activities.length - 8} more notifications →
                      </button>
                    </Link>
                  </div>
                )}
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
