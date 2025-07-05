import { FiHome, FiList, FiUser, FiCreditCard, FiAlertTriangle, FiBell } from "react-icons/fi";
import { Link, useLocation } from "wouter";

export function MobileNav() {
  const [location] = useLocation();

  // Utility to check active route
  const isActive = (path) => location === path;

  // Replace this with your actual unread notification count
  const unreadCount = 3;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f0f1f]/95 py-1 px-4 flex justify-around items-center z-50 backdrop-blur-xl border-t border-white/10 shadow-lg">
        {[
          { href: "/", label: "Home", icon: FiHome },
          { href: "/entries", label: "Entries", icon: FiList },
          { href: "/payments", label: "Payments", icon: FiCreditCard },
          { href: "/penalties", label: "Penalties", icon: FiAlertTriangle },
          { href: "/notifications", label: "Message", icon: FiBell },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <a
              className={`relative group flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${
                isActive(href) ? "text-[#ab6cff]" : "text-white/70 hover:text-white"
              }`}
            >
              {/* Highlight Box */}
              <div
                className={`absolute top-1 left-1/2 -translate-x-1/2 mt-[-2px] w-16 h-16 rounded-xl transition-all duration-300 ${
                  isActive(href)
                    ? "bg-[#582c84]/20 shadow-inner"
                    : "bg-white/5 opacity-0 group-hover:opacity-100"
                }`}
              ></div>

              {/* Icon + Text */}
              <div className="relative flex flex-col items-center justify-center px-3 py-2">
                <div className={`p-2 rounded-full transition-all duration-300 ${isActive(href) ? "bg-[#582c84]/30" : ""} relative`}>
                  <Icon className={`w-5 h-5 transition-all duration-300 ${isActive(href) ? "scale-110" : ""}`} />
                  {/* Notification badge for bell icon */}
                  {href === "/notifications" && unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#0f0f1f] shadow-md">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
                <span className="mt-1 text-[10px] font-medium">{label}</span>
              </div>
            </a>
          </Link>
        ))}
      </nav>
    </>
  );
}
