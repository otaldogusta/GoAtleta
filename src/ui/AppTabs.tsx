import { ScrollView, Text, View } from "react-native";

import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export function AppTabs<T extends string>({
  fullWidth = true,
  onChange,
  scrollable = false,
  tabs,
  value,
}: {
  fullWidth?: boolean;
  onChange: (value: T) => void;
  scrollable?: boolean;
  tabs: Array<{ label: string; value: T }>;
  value: T;
}) {
  const { colors } = useAppTheme();

  const content = (
    <View
      style={{
        flexDirection: "row",
        flexWrap: scrollable ? "nowrap" : "wrap",
        gap: 6,
        padding: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        alignSelf: fullWidth && !scrollable ? "stretch" : "flex-start",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={{
              flex: fullWidth && !scrollable ? 1 : undefined,
              minHeight: 34,
              minWidth: scrollable ? 120 : undefined,
              paddingHorizontal: 12,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.primaryBg : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? colors.primaryText : colors.secondaryText,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return content;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {content}
    </ScrollView>
  );
}
