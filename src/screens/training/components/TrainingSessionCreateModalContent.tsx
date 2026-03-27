import { Ionicons } from "@expo/vector-icons";
import { memo, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { buildTrainingSessionWindow } from "../../../db/training-sessions";
import { Button } from "../../../ui/Button";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { DateInput } from "../../../ui/DateInput";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { TimeInput } from "../../../ui/TimeInput";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";
import { TrainingAnchoredDropdownOption } from "./TrainingAnchoredDropdownOption";

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
  const { colors } = useAppTheme();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState(nextRoundedClock());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const initialIds = defaultClassIds.filter(Boolean);
    setSelectedClassIds(initialIds);
    setDate(/^\d{4}-\d{2}-\d{2}$/.test(defaultDate ?? "") ? String(defaultDate) : todayIso());
    const initialClass = initialIds.length
      ? classes.find((item) => item.id === initialIds[0])
      : null;
    setStartTime(
      /^\d{2}:\d{2}$/.test(defaultStartTime ?? "")
        ? String(defaultStartTime)
        : initialClass?.startTime || nextRoundedClock()
    );
    setSaving(false);
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

  const summaryLabel = useMemo(() => {
    if (!selectedClasses.length) return "Selecione uma ou mais turmas";
    return selectedClasses.length > 1
      ? `${selectedClasses.length} turmas selecionadas`
      : selectedClasses[0]?.name || "Treino";
  }, [selectedClasses]);

  const sessionTypeLabel = selectedClasses.length > 1 ? "Treino integrado" : "Treino normal";

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
      cardStyle={{ maxWidth: 920, width: "100%", maxHeight: "92%" }}
      colors={colors}
      title="Criar treino"
      subtitle="Selecione uma ou mais turmas. Duas ou mais viram treino integrado."
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
      contentContainerStyle={{ gap: 12, paddingBottom: 4, paddingTop: 12 }}
    >
      <View
        style={[
          getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),
          { gap: 8 },
        ]}
      >
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Turmas</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Toque nas turmas que vão treinar juntas.
        </Text>

        <View style={{ gap: 12 }}>
          {groupedClasses.map((group) => (
            <View key={group.unit} style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                {group.unit}
              </Text>
              <View style={{ gap: 6 }}>
                {group.items.map((item) => {
                  const active = selectedClassIds.includes(item.id);
                  return (
                    <TrainingAnchoredDropdownOption
                      key={item.id}
                      active={active}
                      onPress={() => handleToggleClass(item.id)}
                      rightAccessory={
                        <Ionicons
                          name={active ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={active ? colors.primaryText : colors.muted}
                        />
                      }
                    >
                      <View style={{ gap: 4 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <Text
                            style={{
                              color: active ? colors.primaryText : colors.text,
                              fontSize: 14,
                              fontWeight: active ? "700" : "600",
                            }}
                          >
                            {item.name}
                          </Text>
                          <ClassGenderBadge gender={item.gender} />
                        </View>
                        <Text style={{ color: active ? colors.primaryText : colors.muted, fontSize: 11 }}>
                          {item.ageBand} • {item.startTime || "Sem horário"}
                        </Text>
                      </View>
                    </TrainingAnchoredDropdownOption>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View
        style={[
          getSectionCardStyle(colors, "info", { padding: 12, radius: 16, shadow: false }),
          { gap: 10 },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ gap: 2, flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              Data e horário
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Defina quando a sessão vai acontecer.
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
              {sessionTypeLabel}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <View style={{ flex: 1, minWidth: 170, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Data</Text>
            <DateInput value={date} onChange={setDate} placeholder="Selecione a data" />
          </View>
          <View style={{ flex: 1, minWidth: 150, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Horário</Text>
            <TimeInput
              value={startTime}
              onChangeText={setStartTime}
              format="clock"
              placeholder="19:00"
            />
          </View>
        </View>
      </View>

      <View
        style={[
          getSectionCardStyle(colors, "primary", { padding: 12, radius: 16, shadow: false }),
          { gap: 8 },
        ]}
      >
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Resumo</Text>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {sessionTitle}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{summaryLabel}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {date ? `${date.split("-").reverse().join("/")}` : "Sem data"} •{" "}
          {startTime || "Sem horário"}
        </Text>
      </View>
    </ModalDialogFrame>
  );
}

export const TrainingSessionCreateModalContent = memo(TrainingSessionCreateModalContentBase);
TrainingSessionCreateModalContent.displayName = "TrainingSessionCreateModalContent";
