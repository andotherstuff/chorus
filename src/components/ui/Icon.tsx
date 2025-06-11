import React from 'react';
import * as LucideIcons from 'lucide-react';

// Custom SVG icons for icons not available in the current lucide-react version
const CustomIcons = {
  Feed: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 11h16" />
      <path d="M4 6h16" />
      <path d="M4 16h16" />
      <path d="M4 21h16" />
    </svg>
  )
};

interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'size'> {
  name: string;
  size?: number;
}

export const Icon = ({ name, size = 24, ...rest }: IconProps) => {
  // First check if it's one of our custom icons
  if (name in CustomIcons) {
    const CustomIcon = CustomIcons[name as keyof typeof CustomIcons];
    return <CustomIcon width={size} height={size} {...rest} />;
  }
  
  // Use type assertion to silence TypeScript errors - this is how lucide-react components are used
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIconComponent = (LucideIcons as any)[name];
  
  if (LucideIconComponent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <LucideIconComponent size={size} {...rest as any} />;
  }
  
  // Fallback to a simple list icon if icon is not found
  return <LucideIcons.List size={size} {...rest} />;
};