import { useLocation, Link } from "wouter";
import {
  FiHome,
  FiList,
  FiCreditCard,
  FiAlertTriangle,
  FiClock,
  FiUsers,
  FiUser,
  FiBell,
  FiChevronRight,
} from "react-icons/fi";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: FiHome },
  { href: "/entries", label: "Entries", icon: FiList },
  { href: "/payments", label: "Payments", icon: FiCreditCard },
  { href: "/penalties", label: "Penalties", icon: FiAlertTriangle },
  { href: "/history", label: "History", icon: FiClock },
  { href: "/notifications", label: "Alerts", icon: FiBell },
  { href: "/profile", label: "Profile", icon: FiUser },
] as const;

export function DesktopSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "CO_ADMIN";
  const firstName = user?.name?.split(" ")[0] || "User";
  const roleLabel = user?.role === "CO_ADMIN" ? "Co-admin" : user?.role === "ADMIN" ? "Admin" : "Member";

  const items = isAdmin
    ? [...NAV_ITEMS, { href: "/manage-users", label: "Users", icon: FiUsers }]
    : NAV_ITEMS;

  return (
    <aside className="hidden md:flex fixed left-4 top-20 bottom-4 z-40 w-[248px] rounded-2xl border border-white/10 bg-[#111120]/95 backdrop-blur-xl px-3 py-3 flex-col shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
      <div className="rounded-xl border border-white/10 bg-[#0f0f1a] px-3 py-3 mb-3">
        <p className="text-[10px] uppercase tracking-wider text-white/35">Roomie</p>
        <p className="text-white font-semibold mt-1 truncate">Hi, {firstName}</p>
        <p className="text-[11px] text-[#c49bff]/75 mt-0.5">{roleLabel}</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <div
                title={item.label}
                className={cn(
                  "group h-11 rounded-xl border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer px-3",
                  active
                    ? "border-[#9f5bf7]/55 bg-gradient-to-br from-[#582c84]/55 to-[#2a1b46]/75"
                    : "border-white/5 bg-white/[0.03] hover:border-[#7c3fbf]/35 hover:bg-[#582c84]/20",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center border",
                    active ? "border-[#9f5bf7]/40 bg-[#582c84]/40" : "border-white/10 bg-black/20 group-hover:border-[#7c3fbf]/35",
                  )}>
                    <Icon
                      className={cn(
                        "w-4.5 h-4.5 transition-colors",
                        active ? "text-[#d5bbff]" : "text-white/55 group-hover:text-[#c49bff]",
                      )}
                    />
                  </div>
                  <span className={cn(
                    "text-sm font-medium truncate",
                    active ? "text-white" : "text-white/75 group-hover:text-white",
                  )}>
                    {item.label}
                  </span>
                </div>
                <FiChevronRight className={cn("w-4 h-4", active ? "text-[#c49bff]" : "text-white/25 group-hover:text-[#c49bff]/70")} />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
        <p className="text-[11px] text-white/55">Quick tip</p>
        <p className="text-[11px] text-white/35 mt-1 leading-relaxed">
          Use this menu to jump across all modules quickly.
        </p>
      </div>
    </aside>
  );
}
