import { FiList, FiUser, FiCreditCard, FiAlertTriangle } from "react-icons/fi";
import { Link, useLocation } from "wouter";

export function MobileNav() {
  const [location] = useLocation();

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-[#241e95] to-indigo-900 py-3 px-6 flex justify-around items-center border-t border-indigo-700/50 shadow-lg z-50">
        <Link href="/">
          <a className={`relative group flex flex-col items-center ${location === '/' ? 'text-white' : 'text-white/70'}`}>
            <div className={`absolute -inset-2 -top-4 rounded-xl transition-all ${location === '/' ? 'bg-white/10' : 'bg-white/5 opacity-0 group-hover:opacity-100'}`}></div>
            <FiList className="w-6 h-6 relative" />
            <span className="text-xs mt-1 relative font-medium">Home</span>
          </a>
        </Link>
        <Link href="/entries">
          <a className={`relative group flex flex-col items-center ${location === '/entries' ? 'text-white' : 'text-white/70'}`}>
            <div className={`absolute -inset-2 -top-4 rounded-xl transition-all ${location === '/entries' ? 'bg-white/10' : 'bg-white/5 opacity-0 group-hover:opacity-100'}`}></div>
            <FiList className="w-6 h-6 relative" />
            <span className="text-xs mt-1 relative font-medium">Entries</span>
          </a>
        </Link>
        <Link href="/payments">
          <a className={`relative group flex flex-col items-center ${location === '/payments' ? 'text-white' : 'text-white/70'}`}>
            <div className={`absolute -inset-2 -top-4 rounded-xl transition-all ${location === '/payments' ? 'bg-white/10' : 'bg-white/5 opacity-0 group-hover:opacity-100'}`}></div>
            <FiCreditCard className="w-6 h-6 relative" />
            <span className="text-xs mt-1 relative font-medium">Payments</span>
          </a>
        </Link>
        <Link href="/penalties">
          <a className={`relative group flex flex-col items-center ${location === '/penalties' ? 'text-white' : 'text-white/70'}`}>
            <div className={`absolute -inset-2 -top-4 rounded-xl transition-all ${location === '/penalties' ? 'bg-white/10' : 'bg-white/5 opacity-0 group-hover:opacity-100'}`}></div>
            <FiAlertTriangle className="w-6 h-6 relative" />
            <span className="text-xs mt-1 relative font-medium">Penalties</span>
          </a>
        </Link>
        <Link href="/profile">
          <a className={`relative group flex flex-col items-center ${location === '/profile' ? 'text-white' : 'text-white/70'}`}>
            <div className={`absolute -inset-2 -top-4 rounded-xl transition-all ${location === '/profile' ? 'bg-white/10' : 'bg-white/5 opacity-0 group-hover:opacity-100'}`}></div>
            <FiUser className="w-6 h-6 relative" />
            <span className="text-xs mt-1 relative font-medium">Profile</span>
          </a>
        </Link>
      </nav>
      <div className="h-20" /> {/* Bottom Spacing */}
    </>
  );
}
