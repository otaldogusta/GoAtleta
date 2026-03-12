import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, TextInput, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { maskCpf } from "../../../utils/cpf";
import { formatRgBr } from "../../../utils/document-normalization";

type Props = {
  ra: string;
  cpfDisplay: string;
  rg: string;
  onChangeRa: (value: string) => void;
  onChangeCpf: (value: string) => void;
  onChangeRg: (value: string) => void;
  readonly?: boolean;
  showRevealCpfButton?: boolean;
  isCpfVisible?: boolean;
  revealCpfBusy?: boolean;
  onRevealCpf?: () => void;
  errors?: { ra?: string; cpf?: string; rg?: string };
};

export function StudentDocumentsFields({
  ra,
  cpfDisplay,
  rg,
  onChangeRa,
  onChangeCpf,
  onChangeRg,
  readonly = false,
  showRevealCpfButton = false,
  isCpfVisible = false,
  revealCpfBusy = false,
  onRevealCpf,
  errors,
}: Props) {
  const { colors } = useAppTheme();
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    color: colors.inputText,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  };

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>RA</Text>
        <TextInput
          value={ra}
          onChangeText={onChangeRa}
          editable={!readonly}
          placeholder={readonly ? "Nao informado" : "2022202626"}
          placeholderTextColor={colors.placeholder}
          keyboardType="numeric"
          style={[
            inputStyle,
            errors?.ra
              ? {
                  borderColor: colors.dangerText,
                }
              : null,
          ]}
        />
        {errors?.ra ? (
          <Text style={{ color: colors.dangerText, fontSize: 11 }}>{errors.ra}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>CPF</Text>
        <View style={{ position: "relative" }}>
          <TextInput
            value={cpfDisplay}
            onChangeText={(value) => onChangeCpf(maskCpf(value))}
            editable={!readonly}
            placeholder={readonly ? "Nao informado" : "000.000.000-00"}
            placeholderTextColor={colors.placeholder}
            keyboardType="numeric"
            style={[
              inputStyle,
              showRevealCpfButton && onRevealCpf ? { paddingRight: 36 } : null,
              errors?.cpf
                ? {
                    borderColor: colors.dangerText,
                  }
                : null,
            ]}
          />
          {showRevealCpfButton && onRevealCpf ? (
            <Pressable
              onPress={onRevealCpf}
              disabled={revealCpfBusy}
              style={{
                position: "absolute",
                right: 10,
                top: 0,
                bottom: 0,
                justifyContent: "center",
                opacity: revealCpfBusy ? 0.7 : 1,
              }}
            >
              {revealCpfBusy ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Ionicons
                  name={isCpfVisible ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.muted}
                />
              )}
            </Pressable>
          ) : null}
        </View>
        {errors?.cpf ? (
          <Text style={{ color: colors.dangerText, fontSize: 11 }}>{errors.cpf}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>RG</Text>
        <TextInput
          value={rg}
          onChangeText={(value) => onChangeRg(formatRgBr(value))}
          editable={!readonly}
          placeholder={readonly ? "Nao informado" : "00.000.000-0"}
          placeholderTextColor={colors.placeholder}
          style={[
            inputStyle,
            errors?.rg
              ? {
                  borderColor: colors.dangerText,
                }
              : null,
          ]}
        />
        {errors?.rg ? (
          <Text style={{ color: colors.dangerText, fontSize: 11 }}>{errors.rg}</Text>
        ) : null}
      </View>
    </View>
  );
}
