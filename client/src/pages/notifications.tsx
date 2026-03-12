import { useEffect, useState } from "react";
import {
  FiBell, FiAlertTriangle, FiCreditCard, FiList, FiUser,
  FiCheck, FiTrash2, FiCheckCircle, FiSettings, FiShield, FiLogIn,
} from "react-icons/fi";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/services/toastService";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "entry" | "payment" | "penalty" | "account";

interface ActivityMeta {
  icon: React.ComponentType<any>;
  label: string;
  category: FilterTab;
  iconBg: string;
  iconColor: string;
  badgeClass: string;
  ringColor: string;
}

function getActivityMeta(activity: Activity): ActivityMeta {
  switch (activity.type) {
    case "ENTRY_ADDED":
    case "ENTRY_UPDATED":
    case "ENTRY_DELETED":
    case "ENTRY_RESTORED":
      return {
        icon: FiList,
        label: activity.type === "ENTRY_ADDED" ? "Entry Added"
          : activity.type === "ENTRY_DELETED" ? "Entry Deleted"
          : activity.type === "ENTRY_RESTORED" ? "Entry Restored"
          : "Entry Updated",
        category: "entry",
        iconBg: "bg-emerald-500/15",
        iconColor: "text-emerald-400",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        ringColor: "border-l-emerald-500/60",
      };
    case "PAYMENT_ADDED":
    case "PAYMENT_STATUS_UPDATED":
      return {
        icon: FiCreditCard,
        label: activity.type === "PAYMENT_ADDED" ? "Payment Recorded" : "Payment Updated",
        category: "payment",
        iconBg: "bg-[#7c3fbf]/20",
        iconColor: "text-[#c49bff]",
        badgeClass: "bg-[#7c3fbf]/15 text-[#c49bff] border-[#7c3fbf]/30",
        ringColor: "border-l-[#7c3fbf]/70",
      };
    case "PENALTY_ADDED":
    case "PENALTY_UPDATED":
    case "PENALTY_DELETED":
      return {
        icon: FiAlertTriangle,
        label: activity.type === "PENALTY_ADDED" ? "Penalty Added"
          : activity.type === "PENALTY_DELETED" ? "Penalty Removed"
          : "Penalty Updated",
        category: "penalty",
        iconBg: "bg-amber-500/15",
        iconColor: "text-amber-400",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        ringColor: "border-l-amber-500/60",
      };
    case "LOGIN":
      return {
        icon: FiLogIn,
        label: "Login",
        category: "account",
        iconBg: "bg-sky-500/15",
        iconColor: "text-sky-400",
        badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        ringColor: "border-l-sky-500/50",
      };
    case "UPDATE_PROFILE":
      return {
        icon: FiUser,
        label: "Profile Updated",
        category: "account",
        iconBg: "bg-blue-500/15",
        iconColor: "text-blue-400",
        badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        ringColor: "border-l-blue-500/50",
      };
    case "CHANGE_PASSWORD":
      return {
        icon: FiShield,
        label: "Password Changed",
        category: "account",
        iconBg: "bg-rose-500/15",
        iconColor: "text-rose-400",
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        ringColor: "border-l-rose-500/50",
      };
    case "FLAT_MANAGEMENT":
    case "USER_DELETED":
      return {
        icon: FiSettings,
        label: activity.type === "USER_DELETED" ? "User Removed" : "Flat Updated",
        category: "account",
        iconBg: "bg-white/10",
        iconColor: "text-white/60",
        badgeClass: "bg-white/5 text-white/50 border-white/10",
        ringColor: "border-l-white/20",
      };
    default:
      return {
        icon: FiBell,
        label: "Update",
        category: "account",
        iconBg: "bg-white/10",
        iconColor: "text-white/60",
        badgeClass: "bg-white/5 text-white/50 border-white/10",
        ringColor: "border-l-white/20",
      };
  }
}

function formatDateKey(key: string) {
  const d = new Date(key);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, d MMM yyyy");
}

const FILTER_TABS: { key: FilterTab; label: string; icon: React.ComponentType<any> }[] = [
  { key: "all", label: "All", icon: FiBell },
  { key: "payment", label: "Payments", icon: FiCreditCard },
  { key: "entry", label: "Entries", icon: FiList },
  { key: "penalty", label: "Penalties", icon: FiAlertTriangle },
  { key: "account", label: "Account", icon: FiUser },
];

export default function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const {
    data: activities = [] as Activity[],
    isLoading,
  } = useQuery<Activity[]>({
    queryKey: ["/api/user/activities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/activities");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const clearNotificationsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/activities");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.message || "Failed to clear notifications");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/activities"], exact: true });
      showSuccess("All notifications cleared");
    },
    onError: (err: any) => {
      showError(err?.message || "Failed to clear notifications");
    },
  });

  const markOneReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/user/activities/${id}/read`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.message || "Failed to mark as read");
      return { id };
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/user/activities"] });
      const prev = queryClient.getQueryData<Activity[]>(["/api/user/activities"]);
      queryClient.setQueryData<Activity[]>(["/api/user/activities"], (old) =>
        old ? old.map((a) => (a._id === id ? { ...a, read: true } : a)) : old
      );
      return { prev };
    },
    onError: (err: any, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/user/activities"], ctx.prev);
      showError(err?.message || "Failed to mark notification as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/activities"], exact: true });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/activities/read-all");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.message || "Failed to mark all as read");
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData<Activity[]>(["/api/user/activities"], (old) =>
        old ? old.map((a) => ({ ...a, read: true })) : old
      );
      showSuccess("All notifications marked as read");
    },
    onError: (err: any) => {
      showError(err?.message || "Failed to mark all as read");
    },
  });

  // Global loader integration
  useEffect(() => {
    showLoader();
    return () => {
      forceHideLoader();
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !clearNotificationsMutation.isPending) {
      setTimeout(() => hideLoader(), 200);
    }
  }, [isLoading, clearNotificationsMutation.isPending]);

  // Filter + group
  const filtered = activeFilter === "all"
    ? activities
    : activities.filter(a => getActivityMeta(a).category === activeFilter);

  const unreadFiltered = filtered.filter(a => !a.read).length;

  const groups: Record<string, Activity[]> = {};
  filtered.forEach((a) => {
    const d = new Date(a.timestamp);
    const key = format(d, "yyyy-MM-dd");
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });
  const orderedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#0f0f20] to-[#1a1a2e]">
      <Header />

      <div className="pt-28 sm:pt-28 pb-28 sm:pb-10 px-3 sm:px-6">
        <div className="max-w-3xl mx-auto">

          {/* ── Page header ── */}
          <div className="flex items-start justify-between mb-5 gap-3">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#582c84]/30 border border-[#7c3fbf]/40 flex items-center justify-center">
                  <FiBell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#c49bff]" />
                </div>
                <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Notifications</h1>
                {unreadFiltered > 0 && (
                  <span className="bg-[#7c3fbf] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadFiltered} new
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-white/40 ml-[42px] sm:ml-[46px]">
                Entries, payments, penalties &amp; account activity
              </p>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {unreadFiltered > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={markAllReadMutation.isPending}
                  onClick={() => markAllReadMutation.mutate()}
                  className="h-8 px-3 text-xs text-[#c49bff] hover:text-white hover:bg-[#582c84]/30 border border-[#7c3fbf]/30 rounded-lg gap-1.5"
                >
                  <FiCheckCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                  <span className="sm:hidden">Read all</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={activities.length === 0 || clearNotificationsMutation.isPending}
                onClick={() => clearNotificationsMutation.mutate()}
                className="h-8 px-3 text-xs text-red-400/80 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg gap-1.5"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{clearNotificationsMutation.isPending ? "Clearing…" : "Clear all"}</span>
              </Button>
            </div>
          </div>

          {/* ── Filter tabs ── */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
            {FILTER_TABS.map(tab => {
              const count = tab.key === "all"
                ? activities.length
                : activities.filter(a => getActivityMeta(a).category === tab.key).length;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border",
                    activeFilter === tab.key
                      ? "bg-[#582c84]/40 border-[#7c3fbf]/60 text-[#d4b3ff] shadow-sm"
                      : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.07]"
                  )}
                >
                  <TabIcon className="w-3 h-3" />
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      activeFilter === tab.key ? "bg-[#7c3fbf]/50 text-[#e0c8ff]" : "bg-white/10 text-white/40"
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Notification list ── */}
          <div className="bg-[#111120] border border-white/[0.07] rounded-2xl overflow-hidden shadow-2xl">
            {filtered.length === 0 ? (
              <div className="py-16 sm:py-20 flex flex-col items-center justify-center text-center px-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#582c84]/20 to-[#1a1a2e] border border-[#7c3fbf]/20 flex items-center justify-center mb-4">
                  <FiBell className="w-7 h-7 sm:w-8 sm:h-8 text-white/20" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-white/80 mb-1">
                  {activeFilter === "all" ? "You're all caught up" : `No ${activeFilter} notifications`}
                </h3>
                <p className="text-white/35 text-xs sm:text-sm max-w-xs">
                  {activeFilter === "all"
                    ? "New bills, entry updates, and penalties will appear here."
                    : `No ${activeFilter} activity yet.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {orderedDates.map((dateKey) => (
                  <div key={dateKey}>
                    {/* Date separator */}
                    <div className="sticky top-0 z-10 px-4 py-2 bg-[#0f0f1e]/90 backdrop-blur-sm border-b border-white/[0.05]">
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white/30">
                        {formatDateKey(dateKey)}
                      </span>
                    </div>

                    <ul className="divide-y divide-white/[0.04]">
                      {groups[dateKey].map((activity) => {
                        const meta = getActivityMeta(activity);
                        const Icon = meta.icon;
                        const d = new Date(activity.timestamp);
                        const timeAgo = formatDistanceToNow(d, { addSuffix: true });
                        const timeExact = format(d, "hh:mm a");
                        return (
                          <li
                            key={activity._id}
                            className={cn(
                              "group flex items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4 transition-all border-l-[3px]",
                              activity.read
                                ? "border-l-transparent bg-transparent hover:bg-white/[0.02]"
                                : `${meta.ringColor} bg-white/[0.025] hover:bg-white/[0.04]`
                            )}
                          >
                            {/* Icon bubble */}
                            <div className={cn(
                              "mt-0.5 h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0",
                              meta.iconBg
                            )}>
                              <Icon className={cn("w-4 h-4 sm:w-4.5 sm:h-4.5", meta.iconColor)} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 justify-between">
                                <div className="min-w-0 flex-1">
                                  {/* Badge + unread dot */}
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={cn(
                                      "text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide",
                                      meta.badgeClass
                                    )}>
                                      {meta.label}
                                    </span>
                                    {!activity.read && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#ab6cff] shrink-0" />
                                    )}
                                  </div>
                                  {/* Description */}
                                  <p className={cn(
                                    "text-sm leading-snug",
                                    activity.read ? "text-white/55" : "text-white/90 font-medium"
                                  )}>
                                    {activity.description}
                                  </p>
                                  {/* Time */}
                                  <p className="mt-1 text-[10px] sm:text-xs text-white/30 flex items-center gap-1">
                                    <span>{timeAgo}</span>
                                    <span className="text-white/15">·</span>
                                    <span>{timeExact}</span>
                                  </p>
                                </div>

                                {/* Mark read button */}
                                {!activity.read && (
                                  <button
                                    type="button"
                                    onClick={() => markOneReadMutation.mutate(activity._id)}
                                    title="Mark as read"
                                    className="shrink-0 mt-0.5 h-7 w-7 rounded-lg border border-[#7c3fbf]/50 bg-[#582c84]/20 text-[#c49bff] hover:bg-[#582c84]/50 hover:border-[#7c3fbf]/80 flex items-center justify-center transition-all"
                                  >
                                    <FiCheck className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {activity.read && (
                                  <FiCheckCircle className="shrink-0 mt-1 w-3.5 h-3.5 text-white/15" />
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="block md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
