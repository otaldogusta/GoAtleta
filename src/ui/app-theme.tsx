import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Platform, useColorScheme as useSystemColorScheme } from "react-native";
import { brandPalette, semanticColors } from "../theme/tokens";
import { figmaColors } from "./figma-colors";
import { usePersistedState } from "./use-persisted-state";

type ThemeMode = "light" | "dark";

export type ThemeColors = {
  backgroundSubtle: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
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
  successBorder: string;
  warningBg: string;
  warningText: string;
  warningBorder: string;
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
  ...semanticColors.light,
  background: isWeb ? "rgba(245, 240, 232, 0.98)" : semanticColors.light.background,
  card: semanticColors.light.surface,
  border: semanticColors.light.borderSubtle,
  text: semanticColors.light.textPrimary,
  muted: semanticColors.light.textMuted,
  placeholder: brandPalette.slateMuted,
  inputBg: semanticColors.light.surfaceElevated,
  inputText: semanticColors.light.textPrimary,
  primaryBg: semanticColors.light.primary,
  primaryText: brandPalette.white,
  primaryDisabledBg: "rgba(90, 107, 130, 0.34)",
  secondaryBg: semanticColors.light.backgroundSubtle,
  secondaryText: semanticColors.light.textSecondary,
  dangerBg: "rgba(229, 72, 77, 0.12)",
  dangerBorder: "rgba(229, 72, 77, 0.32)",
  dangerText: "#9F1D24",
  thumbFallback: brandPalette.areiaDeep,
  successBg: "rgba(61, 220, 132, 0.18)",
  successText: "#145C39",
  successBorder: "rgba(39, 184, 106, 0.34)",
  warningBg: "rgba(242, 160, 61, 0.18)",
  warningText: "#7A4309",
  warningBorder: "rgba(242, 160, 61, 0.36)",
  dangerSolidBg: semanticColors.light.danger,
  dangerSolidText: brandPalette.white,
  infoBg: "rgba(59, 130, 246, 0.12)",
  infoText: "#1D4ED8",
};

const baseDarkColors: ThemeColors = {
  ...semanticColors.dark,
  background: isWeb ? "rgba(14, 23, 41, 0.98)" : semanticColors.dark.background,
  card: semanticColors.dark.surface,
  border: semanticColors.dark.borderSubtle,
  text: semanticColors.dark.textPrimary,
  muted: semanticColors.dark.textMuted,
  placeholder: semanticColors.dark.textMuted,
  inputBg: semanticColors.dark.surfaceElevated,
  inputText: semanticColors.dark.textPrimary,
  primaryBg: semanticColors.dark.primary,
  primaryText: brandPalette.navyDeep,
  primaryDisabledBg: "rgba(138, 154, 179, 0.26)",
  secondaryBg: semanticColors.dark.backgroundSubtle,
  secondaryText: semanticColors.dark.textSecondary,
  dangerBg: "rgba(248, 113, 113, 0.16)",
  dangerBorder: "rgba(248, 113, 113, 0.36)",
  dangerText: "#FCA5A5",
  thumbFallback: brandPalette.graphite,
  successBg: "rgba(61, 220, 132, 0.20)",
  successText: "#BFF7D7",
  successBorder: "rgba(61, 220, 132, 0.40)",
  warningBg: "rgba(242, 160, 61, 0.20)",
  warningText: "#F8D394",
  warningBorder: "rgba(242, 160, 61, 0.42)",
  dangerSolidBg: semanticColors.dark.danger,
  dangerSolidText: brandPalette.navyDeep,
  infoBg: "rgba(147, 197, 253, 0.16)",
  infoText: "#BFDBFE",
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
