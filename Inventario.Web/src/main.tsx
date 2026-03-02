import React, { useEffect, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  MantineProvider,
  type MantineColorsTuple,
  createTheme,
  localStorageColorSchemeManager,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./app/App";
import { AppThemeContext, type AppStylePreset } from "./app/theme/AppThemeContext";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const colorSchemeManager = localStorageColorSchemeManager({
  key: "inventario-color-scheme",
});

const techBlue: MantineColorsTuple = [
  "#eaf1ff",
  "#d5e2ff",
  "#abc4ff",
  "#7fa4ff",
  "#5c8bff",
  "#3e77ff",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
];

const socCyan: MantineColorsTuple = [
  "#e5f8ff",
  "#ccefff",
  "#99dfff",
  "#66ceff",
  "#33beff",
  "#12b0f6",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#075985",
];

const enterpriseIndigo: MantineColorsTuple = [
  "#ebebff",
  "#d8d6ff",
  "#b1acff",
  "#8c84ff",
  "#6d63ff",
  "#5a52f6",
  "#4f46e5",
  "#4338ca",
  "#3730a3",
  "#312e81",
];

export function AppRoot() {
  const [stylePreset, setStylePreset] = useLocalStorage<AppStylePreset>({
    key: "inventario-style-preset",
    defaultValue: "tech-corporate",
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-app-style", stylePreset);
  }, [stylePreset]);

  const theme = useMemo(() => {
    const presetTheme = {
      "tech-corporate": { primaryColor: "techBlue", colors: { techBlue } },
      "soc-professional": { primaryColor: "socCyan", colors: { socCyan } },
      "premium-enterprise": {
        primaryColor: "enterpriseIndigo",
        colors: { enterpriseIndigo },
      },
    }[stylePreset];

    return createTheme({
      primaryColor: presetTheme.primaryColor,
      colors: presetTheme.colors,
      defaultRadius: "md",
      fontFamily:
        "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      headings: {
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      },
    });
  }, [stylePreset]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeContext.Provider value={{ stylePreset, setStylePreset }}>
        <MantineProvider
          colorSchemeManager={colorSchemeManager}
          defaultColorScheme="auto"
          theme={theme}
        >
          <Notifications position="top-right" />
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MantineProvider>
      </AppThemeContext.Provider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
