import { useEffect } from "react";
import { FiBell, FiAlertTriangle, FiCreditCard, FiList, FiUser } from "react-icons/fi";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/services/toastService";

function getActivityMeta(activity: Activity) {
  const base = {
    icon: FiBell as React.ComponentType<any>,
    label: "Update",
    bubbleClass: "bg-white/10 text-white",
  };
  switch (activity.type) {
    case "ENTRY_ADDED":
    case "ENTRY_UPDATED":
    case "ENTRY_DELETED":
    case "ENTRY_RESTORED":
      return { ...base, icon: FiList, label: "Entry", bubbleClass: "bg-emerald-500/15 text-emerald-300" };
    case "PAYMENT_ADDED":
    case "PAYMENT_STATUS_UPDATED":
      return { ...base, icon: FiCreditCard, label: "Payment", bubbleClass: "bg-[#ab6cff]/15 text-[#c9a7ff]" };
    case "PENALTY_ADDED":
    case "PENALTY_UPDATED":
    case "PENALTY_DELETED":
      return { ...base, icon: FiAlertTriangle, label: "Penalty", bubbleClass: "bg-amber-500/15 text-amber-300" };
    case "LOGIN":
      return { ...base, icon: FiUser, label: "Login", bubbleClass: "bg-sky-500/15 text-sky-300" };
    case "UPDATE_PROFILE":
    case "CHANGE_PASSWORD":
    case "FLAT_MANAGEMENT":
    case "USER_DELETED":
    default:
      return base;
  }
}

export default function NotificationsPage() {
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

  // Group activities by calendar day
  const groups: Record<string, Activity[]> = {};
  activities.forEach((a) => {
    const d = new Date(a.timestamp);
    const key = format(d, "PPP");
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });
  const orderedDates = Object.keys(groups).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#151525] to-[#1a1a2e]">
      <Header />

      {/* Main Content */}
      <div className="pt-32 sm:pt-28 pb-24 px-5 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-3xl font-semibold text-white flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-xl bg-[#582c84]/25 border border-[#7140b5]/50 p-1.5 sm:p-2 shadow-sm">
                  <FiBell className="w-4 h-4 sm:w-5 sm:h-5 text-[#c49bff]" />
                </span>
                Notifications
              </h1>
              <p className="text-xs sm:text-base text-white/55 mt-1">
                Latest activity about entries, payments, penalties and account updates.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={activities.length === 0 || clearNotificationsMutation.isPending}
              onClick={() => clearNotificationsMutation.mutate()}
              className="border-[#7140b5]/60 text-[#d0b3ff] hover:text-white hover:bg-[#582c84]/40 bg-[#582c84]/10 text-xs sm:text-base rounded-full px-4 sm:px-5"
            >
              {clearNotificationsMutation.isPending ? "Clearing…" : "Clear all"}
            </Button>
          </div>

          <div className="bg-[#151525] border border-white/10 rounded-2xl sm:rounded-2xl shadow-lg overflow-hidden">
            <ScrollArea className="max-h-[68vh]">
              {activities.length === 0 ? (
                <div className="py-16 sm:py-20 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#ab6cff]/18 to-[#582c84]/24 flex items-center justify-center mb-4">
                    <FiBell className="w-8 h-8 sm:w-10 sm:h-10 text-white/40" />
                  </div>
                  <h3 className="text-lg sm:text-2xl font-semibold text-white mb-1">You&apos;re all caught up</h3>
                  <p className="text-white/60 text-sm sm:text-base max-w-md">
                    When something important happens — like a new bill, entry update or penalty — it will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {orderedDates.map((dateKey) => (
                    <div key={dateKey} className="px-4 py-4 sm:px-6 sm:py-5">
                      <p className="text-xs sm:text-sm uppercase tracking-wide text-white/40 mb-2">
                        {dateKey}
                      </p>
                      <ul className="space-y-2">
                        {groups[dateKey].map((activity) => {
                          const meta = getActivityMeta(activity);
                          const Icon = meta.icon;
                          const d = new Date(activity.timestamp);
                          const timeAgo = formatDistanceToNow(d, { addSuffix: true });
                          return (
                            <li
                              key={activity._id}
                              className="flex items-start gap-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] px-3 py-2.5 sm:px-4 sm:py-3"
                            >
                              <div
                                className={`mt-0.5 h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold ${meta.bubbleClass}`}
                              >
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className={`text-sm sm:text-base leading-snug ${activity.read ? "text-white/70" : "text-white"}`}>
                                      {activity.description}
                                    </p>
                                    <p className="mt-1 text-xs sm:text-sm text-white/60">{timeAgo}</p>
                                  </div>
                                  {!activity.read && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => markOneReadMutation.mutate(activity._id)}
                                      className="ml-1 h-6 w-6 sm:h-7 sm:w-7 rounded-full border border-white/15 bg-white/5 text-[10px] text-white/70 hover:bg-white/15"
                                    >
                                      ✓
                                    </Button>
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
            </ScrollArea>
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
