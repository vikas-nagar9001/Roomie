import React from 'react';

export default function Loader() {
  return (
    <div className="fixed inset-0 bg-[#05051e]/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-violet-400/20 border-t-violet-600 animate-spin"></div>
        <div className="h-16 w-16 rounded-full border-4 border-violet-400/10 border-b-violet-600 animate-spin absolute top-0 -scale-x-100"></div>
      </div>
    </div>
  );
}
