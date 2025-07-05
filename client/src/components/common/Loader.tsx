import React, { useEffect, useState } from 'react';

// Global logo cache
let globalLogoCache: string | null = null;

export default function Loader() {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    const loadLogo = async () => {
      try {
        // Check global cache first
        if (globalLogoCache) {
          setLogoSrc(globalLogoCache);
          return;
        }

        // Check localStorage cache
        const cachedLogo = localStorage.getItem('roomie-logo-cache');
        if (cachedLogo) {
          globalLogoCache = cachedLogo;
          setLogoSrc(cachedLogo);
          return;
        }

        // Check sessionStorage cache
        const sessionCachedLogo = sessionStorage.getItem('roomie-logo-cache');
        if (sessionCachedLogo) {
          globalLogoCache = sessionCachedLogo;
          setLogoSrc(sessionCachedLogo);
          localStorage.setItem('roomie-logo-cache', sessionCachedLogo);
          return;
        }

        // Load and convert logo to base64 for permanent caching
        const response = await fetch('/logo-200*200.png');
        const blob = await response.blob();
        
        const reader = new FileReader();
        reader.onload = () => {
          const base64Logo = reader.result as string;
          
          // Store in all cache levels
          globalLogoCache = base64Logo;
          localStorage.setItem('roomie-logo-cache', base64Logo);
          sessionStorage.setItem('roomie-logo-cache', base64Logo);
          setLogoSrc(base64Logo);
        };
        reader.readAsDataURL(blob);
        
      } catch (error) {
        console.warn('Logo caching failed, using fallback:', error);
        // Fallback to direct image source
        setLogoSrc('/logo-200*200.png');
      }
    };

    loadLogo();
  }, []);

  return (
    <div className="fixed inset-0 bg-[#05051e]/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative flex flex-col items-center">
        {/* Logo Animation */}
        <div className="relative">
          {logoSrc ? (
            <img 
              src={logoSrc} 
              alt="Roomie Logo" 
              className="w-10 h-10 animate-pulse"
              style={{ display: 'block' }}
              onLoad={() => {
                // Ensure it's cached for next time
                if (logoSrc.startsWith('data:')) {
                  globalLogoCache = logoSrc;
                }
              }}
            />
          ) : (
            // Ultra-fast fallback while logo loads
            <div className="w-10 h-10 bg-[#ab6cff]/20 rounded-full animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 bg-[#ab6cff]/60 rounded-full animate-pulse"></div>
            </div>
          )}
          <div className="absolute inset-0 border-2 border-[#ab6cff]/30 rounded-full animate-ping"></div>
        </div>
        
        {/* Loading Text */}
        <div className="mt-2 text-white/60 text-xs font-normal">
          Loading...
        </div>
      </div>
    </div>
  );
}
