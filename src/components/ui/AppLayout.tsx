import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';
import Header from './Header';

interface AppLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export function AppLayout({ children, showHeader = true }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      
      <div className="flex-1">
        {/* Mobile header - only visible on small screens */}
        {showHeader && (
          <div className="md:hidden sticky top-0 z-10 bg-background border-b">
            <div className="container mx-auto py-3 px-4">
              <Header className="mb-0" />
            </div>
          </div>
        )}
        
        <div className="container mx-auto py-4 px-6 pb-20 md:pb-4">
          {/* Desktop header - only visible when sidebar is hidden */}
          {showHeader && <div className="hidden md:block"><Header /></div>}
          <main>{children}</main>
        </div>
        
        {/* Mobile navigation */}
        <MobileNav />
      </div>
    </div>
  );
}