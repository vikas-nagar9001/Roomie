import { FiList, FiUser, FiCreditCard, FiAlertTriangle } from "react-icons/fi";
import { Link, useLocation } from "wouter";

export function MobileNav() {
  const [location] = useLocation();

  // Utility to check active route
  const isActive = (path) => location === path;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f0f1f] py-4 px-6 flex justify-around items-center z-50 backdrop-blur-md">
        {[
          { href: "/", label: "Home", icon: FiList },
          { href: "/entries", label: "Entries", icon: FiList },
          { href: "/payments", label: "Payments", icon: FiCreditCard },
          { href: "/penalties", label: "Penalties", icon: FiAlertTriangle },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <a
              className={`relative group flex flex-col items-center justify-center text-xs font-medium transition-colors duration-300 ${
                isActive(href) ? "text-white" : "text-white/70 hover:text-white"
              }`}
            >
              {/* Highlight Box */}
              <div
                className={`absolute top-0 left-1/2 -translate-x-1/2 mt-[-2px] w-16 h-16 rounded-xl transition-all duration-300 ${
                  isActive(href)
                    ? "bg-white/10 shadow-inner"
                    : "bg-white/5 opacity-0 group-hover:opacity-100"
                }`}
              ></div>

              {/* Icon + Text */}
              <div className="relative flex flex-col items-center justify-center px-3 py-2">
                <Icon className="w-6 h-6" />
                <span className="mt-1">{label}</span>
              </div>
            </a>
          </Link>
        ))}
      </nav>
      <div className="h-20" /> {/* Bottom Spacing */}
    </>
  );
}
