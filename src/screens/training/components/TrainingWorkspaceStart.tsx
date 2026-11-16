import { useState } from "react";
import { View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { compactUiMetrics, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui/Button";
import { CompactSelect } from "../../../ui/CompactSelect";
import { DateInput } from "../../../ui/DateInput";
import { DatePickerModal } from "../../../ui/DatePickerModal";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { OperationalText as Text } from "../../../ui/OperationalText";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { getClassIdentityLabel } from "../application/class-identity";

type Props = {
  classes: ClassGroup[];
  initialClassId: string;
  initialDate: string;
  onCreate: (classGroup: ClassGroup | null, date: string) => void;
  onOpenLibrary?: () => void;
  onClose?: () => void;
};

export function TrainingWorkspaceStart({ classes, initialClassId, initialDate, onCreate, onOpenLibrary, onClose }: Props) {
  const { colors } = useAppTheme();
  const [classId, setClassId] = useState(initialClassId);
  const [date, setDate] = useState(initialDate);
  const [showCalendar, setShowCalendar] = useState(false);
  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const classOptions = [
    { value: "", label: "Sem turma · rascunho" },
    ...classes.map((item) => ({ value: item.id, label: [getClassIdentityLabel(item, classes), item.unit].filter(Boolean).join(" · ") })),
  ];

  return (
    <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "600" }}>Novo plano de aula</Text>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar novo plano" onPress={onClose} style={{ width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, justifyContent: "center", alignItems: "center" }}>
            <GoAtletaIcon name="close" size={compactUiMetrics.iconSize} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <CompactSelect label="Turma" value={selectedClass?.id ?? ""} options={classOptions} onChange={setClassId} />
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize }}>Data de referência</Text>
          <DateInput accessibilityLabel="Data de referência do plano" value={date} onChange={setDate} onOpenCalendar={() => setShowCalendar(true)} />
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs }}>
        <Button label="Criar plano" onPress={() => onCreate(selectedClass, date)} disabled={!date} />
        {onOpenLibrary ? <Button label="Abrir biblioteca" onPress={onOpenLibrary} variant="ghost" /> : null}
      </View>
      {showCalendar ? <DatePickerModal visible value={date} onChange={setDate} onClose={() => setShowCalendar(false)} closeOnSelect /> : null}
    </View>
  );
}
