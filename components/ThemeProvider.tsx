"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const saved = localStorage.getItem("inkhaven-theme");
    if (saved === "light" || saved === "dark" || saved === "sepia") {
      useUIStore.getState().setTheme(saved);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "sepia");
    root.classList.add(theme);
    localStorage.setItem("inkhaven-theme", theme);
  }, [theme]);

  return <>{children}</>;
}
