import { Platform, TextInput, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useAppTheme } from "../../ui/app-theme";

export function FinanceCompactInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <View
        style={{
          minHeight: 50,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          justifyContent: "center",
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          style={[
            {
              minHeight: 50,
              paddingVertical: 0,
              borderWidth: 0,
              borderRadius: 0,
              color: colors.inputText,
              backgroundColor: "transparent",
            },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
          ]}
        />
      </View>
    </View>
  );
}
