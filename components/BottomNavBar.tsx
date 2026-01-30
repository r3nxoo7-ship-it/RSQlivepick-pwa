"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Radio, Filter, BarChart2, Settings, Share2 } from "lucide-react";

const navItems = [
  { label: "Home", icon: Home, href: "/dashboard" },
  { label: "Live", icon: Radio, href: "/dashboard/live" },
  { label: "Filters", icon: Filter, href: "/dashboard/filters" },
  { label: "Library", icon: Share2, href: "/dashboard/library" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

export default function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-glass-light border-t border-glass-lighter shadow-lg flex justify-around items-center h-16 md:hidden">
      {navItems.map(({ label, icon: Icon, href }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <button
            key={label}
            onClick={() => router.push(href)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition text-xs font-semibold ${active ? "text-accent-cyan" : "text-text-secondary"}`}
            aria-label={label}
          >
            <Icon className={`w-6 h-6 mb-1 ${active ? "stroke-2" : "stroke-1.5"}`} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
