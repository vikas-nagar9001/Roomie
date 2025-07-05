import React from 'react';

export default function Loader() {
  return (
    <div className="fixed inset-0 bg-[#05051e]/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative flex flex-col items-center">
        {/* Logo Animation */}
        <div className="relative">
          <img 
            src="/logo-200*200.png" 
            alt="Roomie Logo" 
            className="w-10 h-10 animate-pulse"
          />
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
