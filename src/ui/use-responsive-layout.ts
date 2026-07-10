import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import {
  resolveResponsiveLayout,
  type ResponsivePageVariant,
} from "./responsive-layout";

export function useResponsiveLayout(
  variant: ResponsivePageVariant = "content"
) {
  const { width } = useWindowDimensions();
  return useMemo(
    () => resolveResponsiveLayout(width, variant),
    [variant, width]
  );
}
