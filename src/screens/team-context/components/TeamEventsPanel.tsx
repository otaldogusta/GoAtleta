import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { TeamEvent, TeamEventImportance, TeamEventType } from "../../../core/team-context";
import { Button } from "../../../ui/Button";
import type { ThemeColors } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";
import { Pressable } from "../../../ui/Pressable";

type TeamEventsPanelProps = {
  colors: ThemeColors;
  events: TeamEvent[];
  onCreate: (input: {
    title: string;
    type: TeamEventType;
    date: string;
    importance: TeamEventImportance;
    opponent?: string;
    location?: string;
    notes?: string;
  }) => Promise<void>;
};

const EVENT_TYPES: Array<{ value: TeamEventType; label: string }> = [
  { value: "training", label: "Treino" },
  { value: "friendly", label: "Amistoso" },
  { value: "official_match", label: "Jogo oficial" },
  { value: "evaluation", label: "Avaliação" },
  { value: "festival", label: "Festival" },
  { value: "meeting", label: "Reunião" },
  { value: "recovery", label: "Recuperação" },
];

const IMPORTANCE_OPTIONS: Array<{ value: TeamEventImportance; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

export function TeamEventsPanel({ colors, events, onCreate }: TeamEventsPanelProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TeamEventType>("friendly");
  const [importance, setImportance] = useState<TeamEventImportance>("medium");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onCreate({ title, date, type, importance, opponent, location, notes });
      setTitle("");
      setOpponent("");
      setLocation("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18 }), { gap: 12 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Próximos eventos</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Registre amistoso, jogo, avaliação ou recuperação.
        </Text>
      </View>

      <TextInput
        placeholder="Título do evento"
        placeholderTextColor={colors.placeholder}
        value={title}
        onChangeText={setTitle}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
        }}
      />

      <TextInput
        placeholder="Data (YYYY-MM-DD)"
        placeholderTextColor={colors.placeholder}
        value={date}
        onChangeText={setDate}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
        }}
      />

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>Tipo</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {EVENT_TYPES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setType(option.value)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: type === option.value ? colors.primaryBg : colors.secondaryBg,
                borderWidth: 1,
                borderColor: type === option.value ? colors.primaryBg : colors.border,
              }}
            >
              <Text
                style={{
                  color: type === option.value ? colors.primaryText : colors.text,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>Importância</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {IMPORTANCE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setImportance(option.value)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: importance === option.value ? colors.primaryBg : colors.secondaryBg,
                borderWidth: 1,
                borderColor: importance === option.value ? colors.primaryBg : colors.border,
              }}
            >
              <Text
                style={{
                  color: importance === option.value ? colors.primaryText : colors.text,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TextInput
        placeholder="Adversário (opcional)"
        placeholderTextColor={colors.placeholder}
        value={opponent}
        onChangeText={setOpponent}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
        }}
      />

      <TextInput
        placeholder="Local (opcional)"
        placeholderTextColor={colors.placeholder}
        value={location}
        onChangeText={setLocation}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
        }}
      />

      <TextInput
        placeholder="Observações (opcional)"
        placeholderTextColor={colors.placeholder}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        style={{
          minHeight: 88,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          textAlignVertical: "top",
        }}
      />

      <Button label="Salvar evento" onPress={handleSubmit} loading={saving} />

      <View style={{ gap: 8 }}>
        {events.length ? (
          events.map((event) => (
            <View
              key={event.id}
              style={{
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {event.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {event.date} • {EVENT_TYPES.find((item) => item.value === event.type)?.label} •{" "}
                {IMPORTANCE_OPTIONS.find((item) => item.value === event.importance)?.label}
              </Text>
              {event.opponent ? (
                <Text style={{ fontSize: 12, color: colors.text }}>Adversário: {event.opponent}</Text>
              ) : null}
              {event.notes ? (
                <Text style={{ fontSize: 12, color: colors.text }}>{event.notes}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Nenhum evento registrado para esta turma.
          </Text>
        )}
      </View>
    </View>
  );
}
