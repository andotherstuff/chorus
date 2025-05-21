// src/hooks/useSystemTheme.ts
import { useEffect, useState } from 'react';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';
const THEME_CLASS = 'dark';
const THEME_STORAGE_KEY = 'chorus-theme-preference';

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
      if (
        theme === 'dark' || 
        (theme === 'system' && mediaQueryList.matches)
      ) {
        document.documentElement.classList.add(THEME_CLASS);
      } else {
        document.documentElement.classList.remove(THEME_CLASS);
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
