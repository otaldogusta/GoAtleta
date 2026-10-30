import { OperationalText as Text } from "./OperationalText";

import { useAppTheme } from "./app-theme";
import { useResponsiveLayout } from "./use-responsive-layout";

export function Typography({
  variant,
  children,
}: {
  variant: "title" | "subtitle" | "body";
  children: any;
}) {
  const { colors } = useAppTheme();
  const { density } = useResponsiveLayout();
  const style =
    variant === "title"
      ? {
          fontSize: density.pageTitleFontSize,
          lineHeight: density.pageTitleLineHeight,
          fontWeight: "700" as const,
          marginBottom: 6,
          color: colors.text,
        }
      : variant === "subtitle"
      ? {
          fontSize: density.sectionTitleFontSize,
          opacity: 0.7,
          marginBottom: 8,
          color: colors.text,
        }
      : {
          fontSize: density.bodyFontSize,
          lineHeight: density.bodyFontSize + 6,
          color: colors.text,
        };

  return <Text style={style}>{children}</Text>;
}
