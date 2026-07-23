import { useEffect, useMemo, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

import {
  resolveResponsiveLayout,
  resolveResponsiveViewportWidth,
  type ResponsivePageVariant,
} from "./responsive-layout";

const readWebLayoutViewportWidth = () => {
  if (
    Platform.OS !== "web" ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const width = document.documentElement?.clientWidth ?? 0;
  return width > 0 ? width : null;
};

export function useResponsiveLayout(
  variant: ResponsivePageVariant = "content"
) {
  const { width: measuredWidth } = useWindowDimensions();
  const [webLayoutViewportWidth, setWebLayoutViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const updateLayoutViewportWidth = () => {
      const nextWidth = readWebLayoutViewportWidth();
      setWebLayoutViewportWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth
      );
    };

    updateLayoutViewportWidth();
    window.addEventListener("resize", updateLayoutViewportWidth);
    window.visualViewport?.addEventListener("resize", updateLayoutViewportWidth);

    return () => {
      window.removeEventListener("resize", updateLayoutViewportWidth);
      window.visualViewport?.removeEventListener("resize", updateLayoutViewportWidth);
    };
  }, []);

  const viewportWidth = resolveResponsiveViewportWidth(
    measuredWidth,
    Platform.OS === "web" ? webLayoutViewportWidth : null
  );

  return useMemo(
    () => resolveResponsiveLayout(viewportWidth, variant),
    [variant, viewportWidth]
  );
}
