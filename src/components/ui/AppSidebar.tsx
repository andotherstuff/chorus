import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Bell, Settings } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

export function AppSidebar() {
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
    <div className="hidden md:flex flex-col gap-2 p-4 border-r h-screen sticky top-0">
      <div className="mb-6">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold">
          <span className="text-red-500 font-extrabold text-3xl">+</span>
          <span>chorus</span>
        </Link>
      </div>
      
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            {item.icon}
            <span>{item.name}</span>
            {item.badge && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}