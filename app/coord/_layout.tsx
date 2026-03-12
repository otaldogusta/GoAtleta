import { Tabs } from "expo-router";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";

export default function CoordinationTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedBottomTabs {...props} role="coord" />}
    >
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
