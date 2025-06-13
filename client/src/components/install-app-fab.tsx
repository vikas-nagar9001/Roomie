import { useState, useEffect } from 'react';
import { MdAppShortcut } from 'react-icons/md';
import { FaMobileAlt } from 'react-icons/fa';
import { useIsMobile } from '@/hooks/use-mobile';

interface InstallAppFabProps {
  className?: string;
}

export function InstallAppFab({ className }: InstallAppFabProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isButtonVisible, setIsButtonVisible] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    // Animate button entrance after a delay
    const timer = setTimeout(() => {
      setIsButtonVisible(true);
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    }
  };

  if (!showInstallButton) return null;

  return (
    <div
      className={`fixed ${isMobile ? 'top-20' : 'bottom-6'} right-6 transform transition-all duration-700 ease-out 
        ${isButtonVisible 
          ? isMobile 
            ? 'translate-y-0 opacity-100' 
            : 'translate-x-0 opacity-100'
          : isMobile 
            ? '-translate-y-full opacity-0' 
            : 'translate-x-[200%] opacity-0'
        }
        z-50 ${className}`}
    >
      <button
        onClick={handleInstallClick}
        className="group relative flex items-center gap-3 p-3 pr-5 rounded-xl 
          bg-gradient-to-r from-[#5433a7] to-[#582c84] text-white shadow-xl 
          hover:shadow-[0_0_30px_rgba(101,58,167,0.5)] transition-all duration-300
          border border-white/10 backdrop-blur-sm"
      >
        {/* App Icon */}
        <div className="relative w-10 h-10 rounded-lg bg-[#0f0f1f] flex items-center justify-center
          overflow-hidden group-hover:scale-105 transition-transform">
          <img 
            src="/static/images/Roomie.png"
            alt="Roomie App"
            className="w-7 h-7 object-contain"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent"></div>
        </div>

        {/* Text Content */}
        <div className="flex flex-col">
          <span className="font-semibold text-sm">Install Roomie</span>
          <div className="flex items-center gap-1 text-white/70">
            <FaMobileAlt className="w-3 h-3" />
            <span className="text-[11px]">Quick access</span>
          </div>
        </div>

        {/* Install Icon */}
        <MdAppShortcut className="w-5 h-5 text-white/90 group-hover:scale-110 transition-transform ml-1" />

        {/* Shine Effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/5 to-white/0 
          group-hover:via-white/10 transition-all duration-500"></div>
        
        {/* Subtle Pulse */}
        <div className="absolute -inset-px rounded-xl animate-pulse bg-white/10 -z-10"></div>
      </button>
    </div>
  );
}
