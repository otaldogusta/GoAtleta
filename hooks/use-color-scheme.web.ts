import { useContext, useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

import { AppThemeContext } from "@/src/ui/app-theme";

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const context = useContext(AppThemeContext);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (context?.mode) {
    return context.mode;
  }
  if (hasHydrated) {
    return colorScheme;
  }

  return "light";
}
