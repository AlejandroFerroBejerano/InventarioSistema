import { createContext, useContext } from "react";

export type AppLanguage = "es" | "en";

type AppI18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (spanish: string, english: string) => string;
  formatDateTime: (value?: string | null) => string;
};

export const AppI18nContext = createContext<AppI18nContextValue | null>(null);

export function useI18n() {
  const context = useContext(AppI18nContext);
  if (!context) {
    throw new Error("useI18n must be used within AppI18nContext.Provider");
  }

  return context;
}
