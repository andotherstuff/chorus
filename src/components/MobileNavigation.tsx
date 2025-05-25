import React from "react";
import { Home, Users, Bell } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  isActive: boolean;
  badge?: number;
}

export function MobileNavigation() {
  const location = useLocation();
  const unreadCount = useUnreadNotificationsCount();

  const navItems: NavItem[] = [
    {
      icon: Home,
      label: "Home",
      href: "/",
      isActive: location.pathname === "/",
    },
    {
      icon: Users,
      label: "Groups",
      href: "/groups",
      isActive: location.pathname === "/groups" || 
               location.pathname.startsWith("/group/") ||
               location.pathname === "/create-group",
    },
    {
      icon: Bell,
      label: "Notifications",
      href: "/settings/notifications",
      isActive: location.pathname === "/settings/notifications",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border/50 md:hidden">
      <div className="flex items-center justify-around h-12 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 min-w-0 flex-1 active:scale-95 relative",
                item.isActive
                  ? "text-primary"
                  : "text-muted-foreground/70 hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-4 w-4 transition-all duration-300", item.isActive && "scale-110")} />
                {item.badge && (
                  <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-background">
                    {item.badge > 9 ? '9+' : item.badge}
                  </div>
                )}
              </div>
              <span className={cn("text-[10px] font-medium truncate transition-all duration-300", 
                item.isActive ? "opacity-100" : "opacity-60")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}