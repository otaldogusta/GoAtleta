import { useEffect, useMemo, useState } from "react";
import { Modal, Text, TextInput, View } from "react-native";

import { createAndStartScoutingSession } from "../scouting-session-actions";
import {
  buildScoutingSessionDraftInput,
  buildScoutingSessionRoute,
  type NewScoutingUiType,
} from "../scouting-session-navigation";
import { Button } from "../../../ui/Button";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";

const todayIso = () => new Date().toISOString().slice(0, 10);

export const formatIsoDateForInput = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

export const normalizeInputDateToIso = (value: string) => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return null;
};

type Props = {
  classId: string;
  initialDate?: string;
  initialSource?: "event" | "manual" | "session";
  initialType?: NewScoutingUiType;
  onClose: () => void;
  onCreated: (route: ReturnType<typeof buildScoutingSessionRoute>) => void;
  visible: boolean;
};

export function NewScoutingSessionPanel({
  classId,
  initialDate,
  initialSource = "manual",
  initialType = "treino",
  onClose,
  onCreated,
  visible,
}: Props) {
  const { colors } = useAppTheme();
  const [scoutingType, setScoutingType] = useState<NewScoutingUiType>(initialType);
  const [date, setDate] = useState(
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? formatIsoDateForInput(initialDate)
      : formatIsoDateForInput(todayIso())
  );
  const [opponent, setOpponent] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setScoutingType(initialType);
    setDate(
      initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
        ? formatIsoDateForInput(initialDate)
        : formatIsoDateForInput(todayIso())
    );
    setOpponent("");
    setNotes("");
    setError("");
  }, [initialDate, initialType, visible]);

  const resolvedDateIso = useMemo(() => normalizeInputDateToIso(date), [date]);

  const handleStart = async () => {
    if (!resolvedDateIso) {
      setError("Informe a data no formato dd/mm/aaaa.");
      return;
    }

    try {
      setIsStarting(true);
      setError("");
      const session = await createAndStartScoutingSession(
        buildScoutingSessionDraftInput({
          classId,
          date: resolvedDateIso,
          uiType: scoutingType,
          opponent: opponent.trim() || undefined,
          source: initialSource,
        })
      );
      onCreated(buildScoutingSessionRoute({ classId, scoutingSessionId: session.id }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível iniciar a análise.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(9,15,28,0.42)",
          padding: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pressable style={{ position: "absolute", inset: 0 }} onPress={onClose} />
        <View
          style={[
            getSectionCardStyle(colors, "neutral", { radius: 22 }),
            { width: "100%", maxWidth: 640, gap: 16 },
          ]}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>Novo scouting</Text>
            <Text style={{ color: colors.muted }}>
              Escolha o contexto e entre direto no registro rápido.
            </Text>
          </View>

          <PickerPills
            label="Tipo"
            value={scoutingType}
            onChange={(value) => setScoutingType(value as NewScoutingUiType)}
            options={[
              { value: "treino", label: "Treino" },
              { value: "amistoso", label: "Amistoso" },
              { value: "jogo", label: "Jogo" },
            ]}
          />

          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Field label="Data" value={date} onChangeText={setDate} placeholder="DD/MM/AAAA" />
            </View>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Field
                label={scoutingType === "treino" ? "Contexto" : "Adversário"}
                value={opponent}
                onChangeText={setOpponent}
                placeholder={scoutingType === "treino" ? "Opcional" : "Nome do adversário"}
              />
            </View>
          </View>

          <Field
            label="Observação rápida"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex.: recepção sob pressão e cobertura pós-ataque"
          />

          {error ? <Text style={{ color: colors.dangerText, fontWeight: "700" }}>{error}</Text> : null}

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <View style={{ width: 140 }}>
              <Button label="Cancelar" onPress={onClose} variant="secondary" disabled={isStarting} />
            </View>
            <View style={{ width: 180 }}>
              <Button label="Iniciar análise" onPress={handleStart} loading={isStarting} disabled={isStarting} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          minHeight: 48,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          paddingVertical: 10,
          color: colors.text,
        }}
      />
    </View>
  );
}

function PickerPills({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.text : colors.border,
                backgroundColor: active ? colors.text : colors.card,
              }}
            >
              <Text style={{ color: active ? colors.background : colors.text, fontWeight: "700" }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
