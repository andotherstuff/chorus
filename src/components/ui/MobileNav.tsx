import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Bell, Settings } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const { user } = useCurrentUser();

  if (!user) {
    return null;
  }

  const navItems = [
    { 
      name: 'Home', 
      path: '/', 
      icon: <Home className="h-5 w-5" /> 
    },
    { 
      name: 'Groups', 
      path: '/groups', 
      icon: <Users className="h-5 w-5" /> 
    },
    { 
      name: 'Notifications', 
      path: '/notifications', 
      icon: <Bell className="h-5 w-5" />,
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: <Settings className="h-5 w-5" /> 
    }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-10">
      <nav className="flex justify-around">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center py-3 px-2 text-xs font-medium transition-colors",
              location.pathname === item.path
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <div className="relative">
              {item.icon}
              {item.badge && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className="mt-1">{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}