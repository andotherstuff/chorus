// src/hooks/useSystemTheme.ts
import { useEffect, useState } from 'react';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';
const THEME_CLASS = 'dark';
const THEME_STORAGE_KEY = 'chorus-theme-preference';

// Theme colors matching the CSS variables
const THEME_COLORS = {
  light: '#ffffff', // --background: 0 0% 100%
  dark: '#020817'   // --background: 222.2 84% 4.9%
};

export function useSystemTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return 'system';
  });

  // Apply theme changes
  useEffect(() => {
    const mediaQueryList = window.matchMedia(MEDIA_QUERY);

    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQueryList.matches);
      
      if (isDark) {
        document.documentElement.classList.add(THEME_CLASS);
      } else {
        document.documentElement.classList.remove(THEME_CLASS);
      }

      // Update meta theme-color
      const themeColor = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', themeColor);
      }

      // Update apple-mobile-web-app-status-bar-style
      const appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (appleStatusBar) {
        // Use 'black-translucent' for dark mode, 'default' for light mode
        appleStatusBar.setAttribute('content', isDark ? 'black-translucent' : 'default');
      }
    };

    // Initial application
    applyTheme();

    // Listen for system preference changes
    if (theme === 'system') {
      mediaQueryList.addEventListener('change', applyTheme);
      return () => {
        mediaQueryList.removeEventListener('change', applyTheme);
      };
    }
  }, [theme]);

  // Function to toggle theme
  const toggleTheme = () => {
    const newTheme = document.documentElement.classList.contains(THEME_CLASS) ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  // Function to set theme explicitly
  const setThemePreference = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  return { theme, toggleTheme, setThemePreference };
}
