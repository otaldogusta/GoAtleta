import { Tabs } from "expo-router";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";

export default function CoordinationTabsLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      tabBar={(props) => <AnimatedBottomTabs {...props} role="coord" />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="org-members" options={{ href: null }} />
      <Tabs.Screen name="communications" options={{ href: null }} />
      <Tabs.Screen name="periodization" options={{ href: null }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
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
  );
}
