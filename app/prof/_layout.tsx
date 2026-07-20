import { Tabs } from "expo-router";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";
import { AppShell } from "../../src/ui/AppShell";

// perf-check: ignore-render -- route-only layout; screens own render instrumentation.
// perf-check: ignore-measure -- route-only layout; no async data is loaded here.
export default function ProfessorTabsLayout() {
  return (
    <AppShell role="prof">
      <Tabs
        tabBar={(props) => <AnimatedBottomTabs {...props} role="prof" />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="students" options={{ href: null }} />
        <Tabs.Screen name="consultation" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="absence-notices" options={{ href: null }} />
        <Tabs.Screen name="nfc-attendance" options={{ href: null }} />
        <Tabs.Screen name="exercises" options={{ href: null }} />
        <Tabs.Screen name="periodization" options={{ href: null }} />
        <Tabs.Screen name="assistant" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="regulation-history" options={{ href: null }} />
        <Tabs.Screen name="home" />
        <Tabs.Screen name="classes" />
        <Tabs.Screen
          name="actions"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
            },
          }}
        />
        <Tabs.Screen name="planning" />
        <Tabs.Screen name="reports" />
      </Tabs>
    </AppShell>
  );
}
