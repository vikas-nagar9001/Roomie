import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";

export default function NotificationsPage() {
  const [dataLoading, setDataLoading] = useState(true);

  // Show loader when the component mounts and set up cleanup
  useEffect(() => {
    showLoader();

    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);

  // Simulate data loading
  useEffect(() => {
    const loadNotifications = async () => {
      // Simulate API call delay
      setTimeout(() => {
        setDataLoading(false);
      }, 800);
    };

    loadNotifications();
  }, []);

  // Hide loader when data is loaded
  useEffect(() => {
    if (!dataLoading) {
      hideLoader();
    }
  }, [dataLoading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#151525] to-[#1a1a2e]">
      <Header />
      
      {/* Main Content */}
      <div className="pt-20 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          

          {/* Coming Soon Message */}
          <div className="text-center py-16 mt-20">
            <div className="w-24 h-24 bg-gradient-to-r from-[#ab6cff]/20 to-[#582c84]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FiBell className="w-12 h-12 text-white/40" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Coming Soon!</h3>
            <p className="text-white/60 max-w-md mx-auto">
              Notifications feature is under development. We'll notify you when it's ready!
            </p>
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
