import React from 'react';
import { cn } from '@/lib/utils';

interface SafeAreaProps {
  children: React.ReactNode;
  className?: string;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  x?: boolean; // left and right
  y?: boolean; // top and bottom
}

/**
 * SafeArea component that applies safe area insets to its children.
 * Useful for ensuring content doesn't get covered by device notches, home indicators, etc.
 * 
 * @param top - Apply safe area inset to top
 * @param bottom - Apply safe area inset to bottom  
 * @param left - Apply safe area inset to left
 * @param right - Apply safe area inset to right
 * @param x - Apply safe area insets to left and right (shorthand)
 * @param y - Apply safe area insets to top and bottom (shorthand)
 */
export function SafeArea({ 
  children, 
  className, 
  top = false, 
  bottom = false, 
  left = false, 
  right = false, 
  x = false, 
  y = false 
}: SafeAreaProps) {
  const safeAreaClasses = cn(
    top || y ? 'safe-area-top' : '',
    bottom || y ? 'safe-area-bottom' : '',
    left || x ? 'safe-area-left' : '',
    right || x ? 'safe-area-right' : '',
    x && !left && !right ? 'safe-area-x' : '',
    className
  );

  return (
    <div className={safeAreaClasses}>
      {children}
    </div>
  );
}