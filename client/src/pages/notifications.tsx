import { useEffect, useState } from "react";
import { FiBell, FiAlertTriangle, FiCheckCircle, FiInfo, FiCreditCard, FiTrash2 } from "react-icons/fi";
import { MdOutlineLocalGroceryStore, MdOutlineNotificationsActive } from "react-icons/md";
import { useLocation } from "wouter";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";

const dummyNotifications = [
  {
    id: 1,
    type: "reminder",
    title: "Milk Entry Reminder",
    message: "Don't forget to add your milk entry for today!",
    icon: <MdOutlineLocalGroceryStore className="text-blue-400 w-6 h-6" />,
    time: "2 min ago",
    color: "from-blue-500/20 to-blue-600/10",
    borderColor: "border-blue-400/30",
    isRead: false
  },
  {
    id: 2,
    type: "penalty",
    title: "Penalty Added",
    message: "You have received a penalty for late payment.",
    icon: <FiAlertTriangle className="text-red-400 w-6 h-6" />,
    time: "10 min ago",
    color: "from-red-500/20 to-red-600/10",
    borderColor: "border-red-400/30",
    isRead: false
  },
  {
    id: 3,
    type: "info",
    title: "Roomie Update",
    message: "New feature: Smart Notifications are now live!",
    icon: <FiInfo className="text-purple-400 w-6 h-6" />,
    time: "1 hour ago",
    color: "from-purple-500/20 to-purple-600/10",
    borderColor: "border-purple-400/30",
    isRead: true
  },
  {
    id: 4,
    type: "success",
    title: "Payment Received",
    message: "Your payment for July has been received. Thank you!",
    icon: <FiCheckCircle className="text-green-400 w-6 h-6" />,
    time: "Yesterday",
    color: "from-green-500/20 to-green-600/10",
    borderColor: "border-green-400/30",
    isRead: true
  },
  {
    id: 5,
    type: "reminder",
    title: "Contribution Reminder",
    message: "You haven't added your monthly contribution yet.",
    icon: <MdOutlineNotificationsActive className="text-yellow-400 w-6 h-6" />,
    time: "2 days ago",
    color: "from-yellow-500/20 to-yellow-600/10",
    borderColor: "border-yellow-400/30",
    isRead: false
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(dummyNotifications);
  const [dataLoading, setDataLoading] = useState(true);

  // Show loader when the component mounts and set up cleanup
  useEffect(() => {
    showLoader();

    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);

  // Simulate data loading (you can replace this with actual API call)
  useEffect(() => {
    const loadNotifications = async () => {
      // Simulate API call delay
      setTimeout(() => {
        setDataLoading(false);
      }, 800); // Adjust timing as needed
    };

    loadNotifications();
  }, []);

  // Hide loader when data is loaded
  useEffect(() => {
    if (!dataLoading) {
      hideLoader();
    }
  }, [dataLoading]);

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#151525] to-[#1a1a2e]">
      <Header />
      
      {/* Main Content */}
      <div className="pt-20 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#ab6cff] to-[#582c84] rounded-2xl mb-4 shadow-lg">
              <FiBell className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Notifications
            </h1>
            <p className="text-white/60 text-lg">
              Stay updated with your roommate activities
            </p>
            
            {/* Stats */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#ab6cff]">{notifications.length}</div>
                <div className="text-sm text-white/60">Total</div>
              </div>
              <div className="w-px h-10 bg-white/20"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{unreadCount}</div>
                <div className="text-sm text-white/60">Unread</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {notifications.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              <Button
                onClick={() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))}
                className="bg-gradient-to-r from-[#ab6cff] to-[#582c84] hover:from-[#9655ff] hover:to-[#4a2470] text-white border-0 rounded-xl px-6 py-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Mark All Read
              </Button>
              <Button
                onClick={clearAllNotifications}
                variant="outline"
                className="border-red-400/30 text-red-400 hover:bg-red-400/10 hover:border-red-400/50 rounded-xl px-6 py-2 font-medium transition-all duration-200"
              >
                <FiTrash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          )}

          {/* Notifications List */}
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative group bg-gradient-to-r ${notification.color} backdrop-blur-sm border ${notification.borderColor} rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] ${
                  !notification.isRead ? 'ring-1 ring-[#ab6cff]/20' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                {/* Unread Indicator */}
                {!notification.isRead && (
                  <div className="absolute top-4 right-4 w-3 h-3 bg-[#ab6cff] rounded-full animate-pulse"></div>
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    {notification.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white group-hover:text-white/90 transition-colors">
                        {notification.title}
                      </h3>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-400/20 hover:text-red-400 rounded-lg w-8 h-8"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <p className="text-white/80 text-base mb-3 leading-relaxed">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/50 font-medium">
                        {notification.time}
                      </span>
                      {!notification.isRead && (
                        <span className="text-xs text-[#ab6cff] font-medium bg-[#ab6cff]/10 px-2 py-1 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {notifications.length === 0 && (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gradient-to-r from-[#ab6cff]/20 to-[#582c84]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FiBell className="w-12 h-12 text-white/40" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
                <p className="text-white/60 max-w-md mx-auto">
                  You don't have any notifications right now. We'll let you know when something important happens.
                </p>
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
