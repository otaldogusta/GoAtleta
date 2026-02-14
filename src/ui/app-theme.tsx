import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Platform, useColorScheme as useSystemColorScheme } from "react-native";
import { figmaColors } from "./figma-colors";
import { usePersistedState } from "./use-persisted-state";

type ThemeMode = "light" | "dark";

export type ThemeColors = {
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  placeholder: string;
  inputBg: string;
  inputText: string;
  primaryBg: string;
  primaryText: string;
  primaryDisabledBg: string;
  secondaryBg: string;
  secondaryText: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;
  thumbFallback: string;
  successBg: string;
  successText: string;
  warningBg: string;
  warningText: string;
  dangerSolidBg: string;
  dangerSolidText: string;
  infoBg: string;
  infoText: string;
};

type AppThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

export const AppThemeContext = createContext<AppThemeContextValue | null>(null);
const isWeb = Platform.OS === "web";

const baseLightColors: ThemeColors = {
  background: isWeb ? "rgba(245, 247, 250, 0.95)" : "#f4f6fa",
  card: isWeb ? "rgba(255, 255, 255, 0.38)" : "#ffffff",
  border: "rgba(15, 23, 42, 0.08)",
  text: "#0f172a",
  muted: "#64748b",
  placeholder: "#94a3b8",
  inputBg: isWeb ? "rgba(255, 255, 255, 0.18)" : "#ffffff",
  inputText: "#0f172a",
  primaryBg: "#0f172a",
  primaryText: "#ffffff",
  primaryDisabledBg: "#94a3b8",
  secondaryBg: isWeb ? "rgba(255, 255, 255, 0.24)" : "#eef2f8",
  secondaryText: "#0f172a",
  dangerBg: "#fee2e2",
  dangerBorder: "#fecaca",
  dangerText: "#991b1b",
  thumbFallback: "#f1f5f9",
  successBg: "#22c55e",
  successText: "#052e16",
  warningBg: "#f59e0b",
  warningText: "#111827",
  dangerSolidBg: "#ef4444",
  dangerSolidText: "#fff",
  infoBg: "#dbeafe",
  infoText: "#1e293b",
};

const baseDarkColors: ThemeColors = {
  background: isWeb ? "rgba(11, 18, 32, 0.95)" : "#0b1222",
  card: isWeb ? "rgba(18, 28, 48, 0.38)" : "#111b30",
  border: "rgba(255, 255, 255, 0.1)",
  text: "#f8fafc",
  muted: "#cbd5e1",
  placeholder: "#cbd5e1",
  inputBg: isWeb ? "rgba(18, 28, 48, 0.22)" : "#15233c",
  inputText: "#f1f5f9",
  primaryBg: "rgba(86, 214, 154, 0.28)",
  primaryText: "#eafff5",
  primaryDisabledBg: "rgba(148, 163, 184, 0.3)",
  secondaryBg: isWeb ? "rgba(20, 30, 52, 0.28)" : "#1a2942",
  secondaryText: "#e2e8f0",
  dangerBg: "#3f1d1d",
  dangerBorder: "#7f1d1d",
  dangerText: "#fecaca",
  thumbFallback: "#1f2937",
  successBg: "#16a34a",
  successText: "#052e16",
  warningBg: "#f59e0b",
  warningText: "#111827",
  dangerSolidBg: "#dc2626",
  dangerSolidText: "#fff",
  infoBg: "#1e3a8a",
  infoText: "#e2e8f0",
};

const lightColors: ThemeColors = {
  ...baseLightColors,
  ...figmaColors.light,
};

const darkColors: ThemeColors = {
  ...baseDarkColors,
  ...figmaColors.dark,
};

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() === "dark" ? "dark" : "light";
  const [overrideMode, setOverrideMode, overrideLoaded] =
    usePersistedState<ThemeMode | null>("theme_override_v1", null);
  const [mode, setModeState] = useState<ThemeMode>(systemScheme);

  useEffect(() => {
    if (!overrideLoaded) return;
    if (overrideMode) {
      setModeState(overrideMode);
      return;
    }
    setModeState(systemScheme);
  }, [overrideLoaded, overrideMode, systemScheme]);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    setOverrideMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    void setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const colors = useMemo(
    () => (mode === "dark" ? darkColors : lightColors),
    [mode]
  );

  const value = useMemo(
    () => ({
      mode,
      colors,
      setMode,
      toggleMode,
    }),
    [mode, colors, setMode, toggleMode]
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    return {
      mode: "light" as ThemeMode,
      colors: lightColors,
      setMode: () => {},
      toggleMode: () => {},
    };
  }
  return context;
}
