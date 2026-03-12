import { Tabs } from "expo-router";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";

export default function StudentTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedBottomTabs {...props} role="student" />}
    >
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
  );
}
