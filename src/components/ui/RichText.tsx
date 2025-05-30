import React from 'react';
import { cn } from '@/lib/utils';

interface RichTextProps {
  children: string;
  className?: string;
}

/**
 * RichText component that renders text with:
 * - Preserved line breaks
 * - Clickable links (http/https URLs)
 * - Proper link styling and security attributes
 */
export function RichText({ children, className }: RichTextProps) {
  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Split text by line breaks first
  const lines = children.split('\n');
  
  const processLine = (line: string, lineIndex: number) => {
    const parts = line.split(urlRegex);
    
    return parts.map((part, partIndex) => {
      // Check if this part is a URL
      if (urlRegex.test(part)) {
        return (
          <a
            key={`${lineIndex}-${partIndex}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all"
          >
            {part}
          </a>
        );
      }
      
      // Regular text
      return part;
    });
  };
  
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {lines.map((line, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {processLine(line, lineIndex)}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
}