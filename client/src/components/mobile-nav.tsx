import {
  FiHome,
  FiList,
  FiCreditCard,
  FiAlertTriangle,
  FiClock,
} from "react-icons/fi";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const sideLeft = [
  { href: "/entries", label: "Entries", icon: FiList },
  { href: "/payments", label: "Payments", icon: FiCreditCard },
] as const;

const sideRight = [
  { href: "/penalties", label: "Penalties", icon: FiAlertTriangle },
  { href: "/history", label: "History", icon: FiClock },
] as const;

function SideTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof FiHome;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-w-0 flex-1 flex-col items-center justify-end rounded-xl py-0.5 transition-all duration-200",
        "active:scale-[0.9] active:duration-100",
        active ? "text-[#d4b4ff]" : "text-white/55 hover:text-white/85",
      )}
    >
      <span
        className={cn(
          "relative z-10 mb-0.5 flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
          active
            ? "scale-105 bg-[#582c84] text-white shadow-[0_4px_14px_-4px_rgba(88,44,132,0.5)] ring-1 ring-[#7c3fbf]/45"
            : "bg-white/[0.05] text-white/65 group-hover:bg-[#582c84]/35 group-hover:text-white",
        )}
      >
        <Icon className={cn("h-[17px] w-[17px]", active && "scale-105")} />
      </span>
      <span
        className={cn(
          "relative z-10 max-w-full truncate px-0.5 text-[8px] font-semibold tracking-tight",
          active && "text-[#e9d5ff]",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function MobileNav() {
  const [location] = useLocation();
  const isActive = (path: string) => location === path;
  const homeActive = isActive("/");

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-2"
      aria-label="Main navigation"
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg rounded-2xl border border-[#7c3fbf]/20 bg-[#13131c]/95 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <div className="relative flex items-end justify-between gap-0 px-1 pb-2 pt-8">
          <div className="flex min-w-0 flex-1 items-end justify-around gap-0.5">
            {sideLeft.map(({ href, label, icon }) => (
              <SideTab key={href} href={href} label={label} icon={icon} active={isActive(href)} />
            ))}
          </div>

          {/* Center — Home / dashboard */}
          <Link
            href="/"
            className={cn(
              "group relative z-20 -mt-[2.35rem] flex shrink-0 flex-col items-center px-1",
              "active:scale-[0.96] transition-transform duration-150",
            )}
          >
            <span
              className={cn(
                "relative flex h-[3.65rem] w-[3.65rem] items-center justify-center rounded-2xl border-2 transition-all duration-300",
                homeActive
                  ? "scale-105 border-[#c49bff]/55 bg-[#582c84] shadow-[0_10px_28px_-6px_rgba(88,44,132,0.65)]"
                  : "border-[#7c3fbf]/35 bg-[#1a1528] group-hover:border-[#7c3fbf]/55 group-hover:bg-[#582c84]/40",
              )}
            >
              <FiHome className={cn("relative h-8 w-8", homeActive ? "text-white" : "text-[#c49bff]")} />
            </span>
            <span
              className={cn(
                "mt-1.5 text-[9px] font-bold tracking-wide",
                homeActive ? "text-[#c49bff]" : "text-indigo-200/75",
              )}
            >
              Home
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 items-end justify-around gap-0.5">
            {sideRight.map(({ href, label, icon }) => (
              <SideTab key={href} href={href} label={label} icon={icon} active={isActive(href)} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
