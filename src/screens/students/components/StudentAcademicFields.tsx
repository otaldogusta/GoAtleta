import { memo, type RefObject } from "react";
import { Text, TextInput, View } from "react-native";

import { useAppTheme } from "../../../ui/app-theme";
import { FormFieldValidationFeedback } from "../../../ui/form-validation-feedback";
import { normalizeRaDigits } from "../../../utils/student-ra";

type Props = {
  ra: string;
  collegeCourse: string;
  onChangeRa: (value: string) => void;
  onChangeCollegeCourse: (value: string) => void;
  readonly?: boolean;
  errors?: { ra?: string };
  raInputRef?: RefObject<TextInput | null>;
  validationAttempt?: number;
};

export const StudentAcademicFields = memo(function StudentAcademicFields({
  ra,
  collegeCourse,
  onChangeRa,
  onChangeCollegeCourse,
  readonly = false,
  errors,
  raInputRef,
  validationAttempt = 0,
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
        <FormFieldValidationFeedback message={errors?.ra} attempt={validationAttempt}>
          <TextInput
            ref={raInputRef}
            value={ra}
            onChangeText={(value) => onChangeRa(normalizeRaDigits(value))}
            editable={!readonly}
            placeholder={readonly ? "N\u00e3o informado" : "2022202626"}
            placeholderTextColor={colors.placeholder}
            keyboardType="numeric"
            accessibilityLabel="RA do aluno"
            style={[
              inputStyle,
              errors?.ra
                ? {
                    borderColor: colors.dangerSolidBg,
                    borderWidth: 2,
                  }
                : null,
            ]}
          />
        </FormFieldValidationFeedback>
      </View>
      <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Curso</Text>
        <TextInput
          value={collegeCourse}
          onChangeText={onChangeCollegeCourse}
          editable={!readonly}
          placeholder={readonly ? "N\u00e3o informado" : "Ex.: Educa\u00e7\u00e3o F\u00edsica"}
          placeholderTextColor={colors.placeholder}
          style={inputStyle}
        />
      </View>
    </View>
  );
});
