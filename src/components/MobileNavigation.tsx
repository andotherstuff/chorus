import { Home, Users, TrendingUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const location = useLocation();

  const navItems = [
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
      icon: TrendingUp,
      label: "Trends",
      href: "/trending",
      isActive: location.pathname === "/trending" || location.pathname.startsWith("/t/"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1 active:scale-95",
                item.isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-transform", item.isActive && "scale-110")} />
              <span className="text-xs font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}