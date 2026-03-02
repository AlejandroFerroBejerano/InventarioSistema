import { createContext, useContext } from "react";

export type AppStylePreset = "tech-corporate" | "soc-professional" | "premium-enterprise";

type AppThemeContextValue = {
  stylePreset: AppStylePreset;
  setStylePreset: (value: AppStylePreset) => void;
};

export const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used inside AppThemeContext provider");
  return ctx;
}

