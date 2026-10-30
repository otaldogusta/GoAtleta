import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";
import { AppShell } from "../../src/ui/AppShell";
import { useAppTheme } from "../../src/ui/app-theme";

// perf-check: ignore-render -- route-only layout; screens own render instrumentation.
// perf-check: ignore-measure -- route-only layout; no async data is loaded here.
export default function ProfessorTabsLayout() {
  const { colors } = useAppTheme();
  return (
    <AppShell role="prof">
      <Tabs
        backBehavior={Platform.OS === "web" ? "fullHistory" : undefined}
        initialRouteName="home"
        tabBar={(props) => <AnimatedBottomTabs {...props} role="prof" />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
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
        <Tabs.Screen name="regulation-history" options={{ href: null }} />
        <Tabs.Screen name="reports" options={{ href: null }} />
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
        <Tabs.Screen name="profile" />
      </Tabs>
    </AppShell>
  );
}
