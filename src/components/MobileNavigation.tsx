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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border/50 md:hidden">
      <div className="flex items-center justify-around h-12 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 min-w-0 flex-1 active:scale-95",
                item.isActive
                  ? "text-primary"
                  : "text-muted-foreground/70 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 transition-all duration-300", item.isActive && "scale-110")} />
              <span className={cn("text-[10px] font-medium truncate transition-all duration-300", 
                item.isActive ? "opacity-100" : "opacity-60")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}