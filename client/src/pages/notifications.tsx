import { useEffect, useState } from "react";
import { FiBell, FiAlertTriangle, FiCheckCircle, FiInfo, FiCreditCard } from "react-icons/fi";
import { MdOutlineLocalGroceryStore, MdOutlineNotificationsActive } from "react-icons/md";
import { useLocation } from "wouter";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";

const dummyNotifications = [
  {
    id: 1,
    type: "reminder",
    title: "Milk Entry Reminder",
    message: "Don't forget to add your milk entry for today!",
    icon: <MdOutlineLocalGroceryStore className="text-blue-400 w-7 h-7" />,
    time: "2 min ago",
    color: "bg-blue-900/60 border-blue-400"
  },
  {
    id: 2,
    type: "penalty",
    title: "Penalty Added",
    message: "You have received a penalty for late payment.",
    icon: <FiAlertTriangle className="text-red-400 w-7 h-7" />,
    time: "10 min ago",
    color: "bg-red-900/60 border-red-400"
  },
  {
    id: 3,
    type: "info",
    title: "Roomie Update",
    message: "New feature: Smart Notifications are now live!",
    icon: <FiInfo className="text-purple-400 w-7 h-7" />,
    time: "1 hour ago",
    color: "bg-purple-900/60 border-purple-400"
  },
  {
    id: 4,
    type: "success",
    title: "Payment Received",
    message: "Your payment for July has been received. Thank you!",
    icon: <FiCheckCircle className="text-green-400 w-7 h-7" />,
    time: "Yesterday",
    color: "bg-green-900/60 border-green-400"
  },
  {
    id: 5,
    type: "reminder",
    title: "Contribution Reminder",
    message: "You haven't added your monthly contribution yet.",
    icon: <MdOutlineNotificationsActive className="text-yellow-400 w-7 h-7" />,
    time: "2 days ago",
    color: "bg-yellow-900/60 border-yellow-400"
  },
];

export default function NotificationsPage() {
  const [location, setLocation] = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Desktop: show as modal, Mobile: show as full page
  return (
    <>
      {/* Overlay for desktop modal */}
      {!isMobile && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center">
          <div className="bg-[#151525] border border-[#582c84]/30 rounded-2xl shadow-2xl max-w-md w-full p-0 overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#582c84]/20 bg-gradient-to-r from-[#582c84]/20 to-[#151525]">
              <div className="flex items-center gap-2">
                <FiBell className="w-6 h-6 text-[#ab6cff]" />
                <span className="text-lg font-bold text-white">Notifications</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setLocation("-") /* go back */}>
                <span className="text-xl text-white/60">×</span>
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar px-4 py-2 bg-[#151525]">
              {dummyNotifications.map((n) => (
                <div key={n.id} className={`flex items-start gap-4 mb-4 p-4 rounded-xl border-l-4 ${n.color} shadow-md hover:scale-[1.01] transition-transform`}>
                  <div>{n.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-base mb-1">{n.title}</div>
                    <div className="text-white/80 text-sm mb-1">{n.message}</div>
                    <div className="text-xs text-white/40 mt-1">{n.time}</div>
                  </div>
                </div>
              ))}
              {dummyNotifications.length === 0 && (
                <div className="text-center text-white/60 py-8">No notifications yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Mobile: full page */}
      {isMobile && (
        <div className="min-h-screen bg-[#151525] pt-20 pb-8 px-2 animate-in fade-in-0 zoom-in-95">
          <Header />
          <div className="max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <FiBell className="w-7 h-7 text-[#ab6cff]" />
              <span className="text-xl font-bold text-white">Notifications</span>
            </div>
            <div className="space-y-4">
              {dummyNotifications.map((n) => (
                <div key={n.id} className={`flex items-start gap-4 p-4 rounded-xl border-l-4 ${n.color} shadow-md`}>
                  <div>{n.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-base mb-1">{n.title}</div>
                    <div className="text-white/80 text-sm mb-1">{n.message}</div>
                    <div className="text-xs text-white/40 mt-1">{n.time}</div>
                  </div>
                </div>
              ))}
              {dummyNotifications.length === 0 && (
                <div className="text-center text-white/60 py-8">No notifications yet.</div>
              )}
            </div>
          </div>

                {/* Mobile Navigation */}
                <div className="block md:hidden">
                  <MobileNav/>
                </div>

        </div>
      )}
    </>
  );
}
