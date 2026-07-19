import { Tabs } from "expo-router";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";
import { AppShell } from "../../src/ui/AppShell";

// perf-check: ignore-render -- route-only layout; screens own render instrumentation.
// perf-check: ignore-measure -- route-only layout; no async data is loaded here.
export default function StudentTabsLayout() {
  return (
    <AppShell role="student">
      <Tabs
        tabBar={(props) => <AnimatedBottomTabs {...props} role="student" />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="home" />
        <Tabs.Screen name="agenda" />
        <Tabs.Screen
          name="actions"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
            },
          }}
        />
        <Tabs.Screen name="achievements" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </AppShell>
  );
}
