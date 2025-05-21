import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
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
        <div className="container mx-auto py-4 px-6">
          {showHeader && <Header />}
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}