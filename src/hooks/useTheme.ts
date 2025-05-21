import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check if document is available (client-side)
    if (typeof document !== "undefined") {
      // Initial theme detection
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");

      // Create a mutation observer to watch for theme changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.attributeName === "class" &&
            mutation.target === document.documentElement
          ) {
            const isDarkNow = document.documentElement.classList.contains("dark");
            setTheme(isDarkNow ? "dark" : "light");
          }
        });
      });

      // Start observing
      observer.observe(document.documentElement, { attributes: true });

      // Cleanup
      return () => {
        observer.disconnect();
      };
    }
  }, []);

  return { theme };
}