"use client";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm
        transition-colors text-gray-400 hover:text-gray-200 hover:bg-gray-800
        dark:hover:bg-gray-800 light:hover:bg-gray-100"
      title="Cambiar tema"
    >
      {theme === "dark"
        ? <Sun className="w-4 h-4 text-yellow-400" />
        : <Moon className="w-4 h-4 text-blue-400" />
      }
    </button>
  );
}
