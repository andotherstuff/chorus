import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PWAInstallInstructions } from './PWAInstallInstructions';
import { usePWA } from '@/hooks/usePWA';

interface PWAInstallButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export function PWAInstallButton({ 
  variant = 'outline', 
  size = 'default', 
  className = '',
  showIcon = true 
}: PWAInstallButtonProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const { isInstallable, isRunningAsPwa, promptInstall } = usePWA();
  
  if (isRunningAsPwa) {
    return null; // Don't show install button if already installed
  }

  const handleClick = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (!success) {
        // If auto-install failed, show instructions
        setShowInstructions(true);
      }
    } else {
      // Show instructions for manual installation
      setShowInstructions(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
      >
        {showIcon && <Download className="w-4 h-4 mr-2" />}
        Install App
      </Button>
      
      <PWAInstallInstructions
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </>
  );
}