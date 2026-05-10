import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { CoachIntervention, CoachInterventionType, TeamEvent } from "../../../core/team-context";
import { Button } from "../../../ui/Button";
import type { ThemeColors } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";
import { Pressable } from "../../../ui/Pressable";

type CoachInterventionsPanelProps = {
  colors: ThemeColors;
  interventions: CoachIntervention[];
  events: TeamEvent[];
  onCreate: (input: {
    date: string;
    type: CoachInterventionType;
    summary: string;
    tags?: string[];
    relatedEventId?: string;
  }) => Promise<void>;
};

const INTERVENTION_TYPES: Array<{ value: CoachInterventionType; label: string }> = [
  { value: "technical", label: "Técnica" },
  { value: "tactical", label: "Tática" },
  { value: "physical", label: "Física" },
  { value: "behavioral", label: "Comportamental" },
  { value: "emotional", label: "Emocional" },
];

export function CoachInterventionsPanel({
  colors,
  interventions,
  events,
  onCreate,
}: CoachInterventionsPanelProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<CoachInterventionType>("tactical");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [relatedEventId, setRelatedEventId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onCreate({
        date,
        type,
        summary,
        tags: tags
          .split(/[,\n;|]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        relatedEventId,
      });
      setSummary("");
      setTags("");
      setRelatedEventId(undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18 }), { gap: 12 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
          Intervenções do professor
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Registre o que foi corrigido hoje e o que deve voltar na próxima sessão.
        </Text>
      </View>

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
          {INTERVENTION_TYPES.map((option) => (
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

      <TextInput
        placeholder="Resumo da intervenção"
        placeholderTextColor={colors.placeholder}
        value={summary}
        onChangeText={setSummary}
        multiline
        numberOfLines={3}
        style={{
          minHeight: 96,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          textAlignVertical: "top",
        }}
      />

      <TextInput
        placeholder="Tags (cobertura, transição, comunicação)"
        placeholderTextColor={colors.placeholder}
        value={tags}
        onChangeText={setTags}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
        }}
      />

      {events.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>Evento relacionado</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={() => setRelatedEventId(undefined)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: relatedEventId ? colors.secondaryBg : colors.primaryBg,
                borderWidth: 1,
                borderColor: relatedEventId ? colors.border : colors.primaryBg,
              }}
            >
              <Text
                style={{
                  color: relatedEventId ? colors.text : colors.primaryText,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                Sem vínculo
              </Text>
            </Pressable>
            {events.slice(0, 4).map((event) => (
              <Pressable
                key={event.id}
                onPress={() => setRelatedEventId(event.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor:
                    relatedEventId === event.id ? colors.primaryBg : colors.secondaryBg,
                  borderWidth: 1,
                  borderColor:
                    relatedEventId === event.id ? colors.primaryBg : colors.border,
                }}
              >
                <Text
                  style={{
                    color:
                      relatedEventId === event.id ? colors.primaryText : colors.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {event.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Button label="Salvar intervenção" onPress={handleSubmit} loading={saving} />

      <View style={{ gap: 8 }}>
        {interventions.length ? (
          interventions.map((item) => (
            <View
              key={item.id}
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
                {item.summary}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {item.date} • {INTERVENTION_TYPES.find((option) => option.value === item.type)?.label}
              </Text>
              {item.tags.length ? (
                <Text style={{ fontSize: 12, color: colors.text }}>
                  Tags: {item.tags.join(", ")}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Nenhuma intervenção registrada para esta turma.
          </Text>
        )}
      </View>
    </View>
  );
}
