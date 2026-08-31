import { Tabs } from "expo-router";

import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";
import { AppShell } from "../../src/ui/AppShell";

// perf-check: ignore-render -- route-only layout; screens own render instrumentation.
// perf-check: ignore-measure -- route-only layout; no async data is loaded here.
export default function FamilyTabsLayout() {
  return (
    <AppShell role="family">
      <Tabs
        tabBar={(props) => <AnimatedBottomTabs {...props} role="family" />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="home" />
        <Tabs.Screen name="agenda" />
        <Tabs.Screen name="payments" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </AppShell>
  );
}
