import type { ReactNode } from "react";
import { View } from "react-native";

import { AppHeader } from "./AppHeader";
import { Screen } from "./Screen";

type TabScreenShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function TabScreenShell({ title, subtitle, children }: TabScreenShellProps) {
  return (
    <Screen>
      <AppHeader title={title} subtitle={subtitle} />
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
    </Screen>
  );
}
