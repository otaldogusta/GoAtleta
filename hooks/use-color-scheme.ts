import { useContext } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

import { AppThemeContext } from "@/src/ui/app-theme";

export function useColorScheme() {
  const systemScheme = useSystemColorScheme() ?? "light";
  const context = useContext(AppThemeContext);
  return context?.mode ?? systemScheme;
}
