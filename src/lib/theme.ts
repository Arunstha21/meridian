export type ThemePreference = "light" | "dark" | "system";

export function applyTheme(theme: ThemePreference) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}
