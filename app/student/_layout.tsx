import { Tabs } from "expo-router";
import { AnimatedBottomTabs } from "../../src/components/navigation/AnimatedBottomTabs";

export default function StudentTabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
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
  );
}
