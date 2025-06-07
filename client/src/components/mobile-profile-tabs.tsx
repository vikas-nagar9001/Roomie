import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LuUser, LuHistory, LuSettings } from "react-icons/lu";
import { useLocation } from "wouter";

interface MobileProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileProfileTabs({ activeTab, onTabChange }: MobileProfileTabsProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const tabs = [
    { id: "profile", label: "Profile", icon: LuUser },
    { id: "activity", label: "Activity", icon: LuHistory },
  ];

  // Add settings tab only for admin users
  if (user?.role === "ADMIN") {
    tabs.push({ id: "flat", label: "Flat Settings", icon: LuSettings });
  }

  return (
    <div className="bg-black/30 backdrop-blur-md rounded-xl border border-white/10 shadow-lg mb-6">
      <div className="grid grid-cols-3 gap-1 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg transition-all duration-300 ${isActive ? "bg-[#6636a3] text-white" : "text-white/70 hover:bg-white/10"}`}
            >
              <div className={`p-2 rounded-full ${isActive ? "bg-white/20" : ""}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}