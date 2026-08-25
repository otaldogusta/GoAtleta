import type { ReactNode } from "react";
import {
  Platform,
  RefreshControl,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type AppRefreshControlProps = RefreshControlProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppRefreshControl(props: AppRefreshControlProps) {
  const {
    children,
    enabled = true,
    onRefresh,
    refreshing,
    style,
    tintColor,
    ...nativeProps
  } = props;

  if (Platform.OS !== "web") {
    return (
      <RefreshControl
        {...nativeProps}
        enabled={enabled}
        onRefresh={onRefresh}
        refreshing={refreshing}
        style={style}
        tintColor={tintColor}
      >
        {children}
      </RefreshControl>
    );
  }

  return <>{children}</>;
}
