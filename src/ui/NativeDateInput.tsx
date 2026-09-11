import { TextInput } from "react-native";

import { useAppTheme } from "./app-theme";

type NativeDateInputProps = {
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
};

export function NativeDateInput({ accessibilityLabel, value, onChangeText }: NativeDateInputProps) {
  const { colors } = useAppTheme();

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      keyboardType="number-pad"
      placeholder="DD/MM/AAAA"
      placeholderTextColor={colors.muted}
      maxLength={10}
      value={value}
      onChangeText={onChangeText}
      style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0, borderRadius: 0 }}
    />
  );
}
