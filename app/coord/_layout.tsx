import { Tabs } from "expo-router";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";
import { AppShell } from "../../src/ui/AppShell";

export default function CoordinationTabsLayout() {
  return (
    <AppShell role="coord">
      <Tabs
        tabBar={(props) => <AnimatedBottomTabs {...props} role="coord" />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="events" options={{ href: null }} />
        <Tabs.Screen name="org-members" options={{ href: null }} />
        <Tabs.Screen name="students" options={{ href: null }} />
        <Tabs.Screen name="communications" options={{ href: null }} />
        <Tabs.Screen name="periodization" options={{ href: null }} />
        <Tabs.Screen name="assistant" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="regulation-history" options={{ href: null }} />
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="classes" />
        <Tabs.Screen
          name="actions"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
            },
          }}
        />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="management" />
      </Tabs>
    </AppShell>
  );
}
