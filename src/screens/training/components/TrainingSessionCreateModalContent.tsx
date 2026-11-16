import { memo, useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { OperationalText as Text } from "../../../ui/OperationalText";

import type { ClassGroup } from "../../../core/models";
import { buildTrainingSessionWindow } from "../../../db/training-sessions";
import { Button } from "../../../ui/Button";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { DateInput } from "../../../ui/DateInput";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { TimeInput } from "../../../ui/TimeInput";
import { useAppTheme } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { compactUiMetrics } from "../../../theme/tokens";

type TrainingSessionCreatePayload = {
  classIds: string[];
  title: string;
  description: string;
  startAt: string;
  endAt: string;
};

type Props = {
  visible: boolean;
  classes: ClassGroup[];
  defaultClassIds?: string[];
  defaultDate?: string;
  defaultStartTime?: string;
  onClose: () => void;
  onCreate: (payload: TrainingSessionCreatePayload) => Promise<void> | void;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const nextRoundedClock = () => {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  const roundedMinutes = currentMinutes === 0 ? 0 : currentMinutes <= 30 ? 30 : 0;
  const roundedHour = currentMinutes > 30 ? (now.getHours() + 1) % 24 : now.getHours();
  return `${String(roundedHour).padStart(2, "0")}:${String(roundedMinutes).padStart(2, "0")}`;
};

const unitLabel = (value: string) => (value && value.trim() ? value.trim() : "Sem unidade");

const joinClassNames = (selectedClasses: ClassGroup[]) =>
  selectedClasses.map((item) => item.name).filter(Boolean).join(" + ");

function TrainingSessionCreateModalContentBase({
  visible,
  classes,
  defaultClassIds = [],
  defaultDate,
  defaultStartTime,
  onClose,
  onCreate,
}: Props) {
  const { colors, mode } = useAppTheme();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState(nextRoundedClock());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const initialIds = defaultClassIds.filter(Boolean);
    Promise.resolve().then(() => {
      setSelectedClassIds(initialIds);
    });
    Promise.resolve().then(() => {
      setDate(/^\d{4}-\d{2}-\d{2}$/.test(defaultDate ?? "") ? String(defaultDate) : todayIso());
    });
    const initialClass = initialIds.length
      ? classes.find((item) => item.id === initialIds[0])
      : null;
    Promise.resolve().then(() => {
      setStartTime(
            /^\d{2}:\d{2}$/.test(defaultStartTime ?? "")
              ? String(defaultStartTime)
              : initialClass?.startTime || nextRoundedClock()
          );
    });
    Promise.resolve().then(() => {
      setSaving(false);
    });
  }, [classes, defaultClassIds, defaultDate, defaultStartTime, visible]);

  const groupedClasses = useMemo(() => {
    const map = new Map<string, ClassGroup[]>();
    classes.forEach((item) => {
      const key = unitLabel(item.unit);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([unit, items]) => ({
        unit,
        items,
      }));
  }, [classes]);

  const selectedClasses = useMemo(
    () => classes.filter((item) => selectedClassIds.includes(item.id)),
    [classes, selectedClassIds]
  );

  const sessionTitle = useMemo(() => {
    if (!selectedClasses.length) return "Treino";
    if (selectedClasses.length > 1) return "Treino Integrado";
    return selectedClasses[0]?.name || "Treino";
  }, [selectedClasses]);

  const sectionTitleStyle = { color: colors.text, fontSize: 13, fontWeight: "800" as const };
  const fieldLabelStyle = { color: colors.muted, fontSize: compactUiMetrics.metadataFontSize };

  const canCreate =
    selectedClasses.length > 0 &&
    Boolean(date) &&
    Boolean(startTime) &&
    !Number.isNaN(new Date(date).getTime());

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((current) =>
      current.includes(classId)
        ? current.filter((item) => item !== classId)
        : [...current, classId]
    );
  };

  const handleCreate = async () => {
    if (!canCreate) {
      Alert.alert("Selecione as turmas", "Escolha ao menos uma turma válida.");
      return;
    }
    const durationMinutes =
      Math.max(...selectedClasses.map((item) => Number(item.durationMinutes || 0)), 60) || 60;
    const { startAt, endAt } = buildTrainingSessionWindow(date, startTime, durationMinutes);
    await onCreate({
      classIds: selectedClasses.map((item) => item.id),
      title: sessionTitle,
      description: joinClassNames(selectedClasses),
      startAt,
      endAt,
    });
  };

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={{ maxWidth: 520, width: "100%", maxHeight: "92%" }}
      colors={colors}
      title="Criar treino"
      dialogLabel="Criar treino"
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label="Cancelar" variant="secondary" onPress={onClose} disabled={saving} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={saving ? "Criando..." : "Criar treino"}
              variant="primary"
              onPress={() => {
                if (saving) return;
                setSaving(true);
                void handleCreate().finally(() => setSaving(false));
              }}
              disabled={!canCreate || saving}
              loading={saving}
            />
          </View>
        </View>
      }
      contentContainerStyle={{ gap: 16, paddingVertical: 8 }}
    >
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
          <Text accessibilityRole="header" style={sectionTitleStyle}>Turmas</Text>
          {selectedClasses.length > 1 ? (
            <Text accessibilityLiveRegion="polite" style={{ ...fieldLabelStyle, color: colors.successText }}>
              {selectedClasses.length} turmas · Treino integrado
            </Text>
          ) : null}
        </View>
        {groupedClasses.length === 0 ? (
          <Text style={fieldLabelStyle}>Nenhuma turma disponível.</Text>
        ) : groupedClasses.map((group) => (
          <View key={group.unit} style={{ gap: 4 }}>
            <Text style={fieldLabelStyle}>{group.unit}</Text>
            {group.items.map((item) => {
              const selected = selectedClassIds.includes(item.id);
              const metadata = [item.ageBand, item.startTime || "Sem horário"].filter(Boolean).join(" · ");
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={[item.name, metadata].filter(Boolean).join(", ")}
                  accessibilityState={{ selected, disabled: saving }}
                  aria-pressed={selected}
                  disabled={saving}
                  onPress={() => handleToggleClass(item.id)}
                  style={{
                    minHeight: compactUiMetrics.touchTarget,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderRadius: 10,
                    borderColor: selected ? colors.successBorder : colors.border,
                    backgroundColor: selected ? colors.successBg : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{item.name}</Text>
                      <ClassGenderBadge gender={item.gender} />
                    </View>
                    <Text style={fieldLabelStyle}>{metadata}</Text>
                  </View>
                  <GoAtletaIcon name={selected ? "checkmarkCircle" : "circleOutline"} size={18} color={selected ? colors.successText : colors.muted} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 8 }}>
        <Text accessibilityRole="header" style={sectionTitleStyle}>Data e horário</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <View style={{ flex: 1.5, minWidth: 145, gap: 4 }}>
            <Text style={fieldLabelStyle}>Data</Text>
            <DateInput compact value={date} onChange={setDate} placeholder="Selecione a data" />
          </View>
          <View style={{ flex: 1, minWidth: 95, gap: 4 }}>
            <Text style={fieldLabelStyle}>Horário</Text>
            <TimeInput
              accessibilityLabel="Horário do treino"
              value={startTime}
              onChangeText={setStartTime}
              format="clock"
              placeholder="19:00"
              style={{ minHeight: compactUiMetrics.modalFieldHeight, borderRadius: 12, backgroundColor: mode === "dark" ? "#121c30" : colors.inputBg }}
            />
          </View>
        </View>
      </View>
    </ModalDialogFrame>
  );
}

export const TrainingSessionCreateModalContent = memo(TrainingSessionCreateModalContentBase);
TrainingSessionCreateModalContent.displayName = "TrainingSessionCreateModalContent";
