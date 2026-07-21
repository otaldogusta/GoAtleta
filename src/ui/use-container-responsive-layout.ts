import { useEffect, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent, View } from "react-native";
import { useWindowDimensions } from "react-native";

import {
  resolveResponsiveLayout,
  type ResponsivePageVariant,
} from "./responsive-layout";

export function useContainerResponsiveLayout(
  variant: ResponsivePageVariant = "content"
) {
  const { width: viewportWidth } = useWindowDimensions();
  const containerRef = useRef<View>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current as unknown as HTMLElement | null;
    if (!element?.getBoundingClientRect || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const updateWidth = () => {
      const nextWidth = Math.round(element.getBoundingClientRect().width);
      setMeasuredWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setMeasuredWidth((current) => (current === nextWidth ? current : nextWidth));
  };
  const width = measuredWidth || viewportWidth;
  const layout = useMemo(
    () => resolveResponsiveLayout(width, variant),
    [variant, width]
  );

  return { containerRef, layout, measuredWidth, onLayout, width };
}
