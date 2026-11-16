import { useState } from "react";
import { Platform, TextInput, View, type TextStyle } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { PositionPicker } from "../../ui/PositionPicker";
import { useAppTheme } from "../../ui/app-theme";

const choices = ["Mulher", "Homem", "Não binário", "Prefiro não informar", "Prefiro descrever"];
const options = choices.map((label) => ({ value: label, label }));

export function GenderIdentityField({ value, onChange, fieldMinHeight }: {
  value: string;
  onChange: (value: string) => void;
  fieldMinHeight?: number;
}) {
  const { colors } = useAppTheme();
  const [describe, setDescribe] = useState(false);
  const custom = describe || Boolean(value && !choices.includes(value));
  return <View style={{ gap: 7 }}>
    <Text style={{ color: colors.muted, fontSize: 13 }}>Gênero</Text>
    <PositionPicker value={custom ? ["Prefiro descrever"] : value ? [value] : []} options={options} maxSelections={1} searchLabel="Pesquisar gênero" fieldMinHeight={fieldMinHeight} onChange={(selected) => {
      const next = selected[0] ?? "";
      setDescribe(next === "Prefiro descrever");
      onChange(next === "Prefiro descrever" ? (custom ? value : "") : next);
    }} />
    {custom ? <View style={{ minHeight: fieldMinHeight ?? 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, justifyContent: "center" }}>
      <TextInput accessibilityLabel="Como você se identifica" placeholder="Como você se identifica" placeholderTextColor={colors.muted} value={value} onChangeText={onChange} maxLength={100} style={{ color: colors.text, fontSize: 14, borderRadius: 0, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) } as TextStyle} />
    </View> : null}
  </View>;
}
