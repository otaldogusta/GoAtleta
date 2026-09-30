import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";

export function PeriodizationScheduleDays({ colors, days, startTime, endTime, onDaysChange, onStartChange, onDurationChange }: {
  colors: ThemeColors; days: number[]; startTime: string; endTime: string;
  onDaysChange: (days: number[]) => void; onStartChange: (value: string) => void;
  onDurationChange: (minutes: number) => void;
}) {
  const [endDraft, setEndDraft] = useState(() => ({ source: endTime, value: endTime }));
  const endInput = endDraft.source === endTime ? endDraft.value : endTime;
  const commitEnd = () => {
    const parse = (value: string) => {
      const match = /^(\d{2}):(\d{2})$/.exec(value);
      return match && Number(match[1]) < 24 && Number(match[2]) < 60
        ? Number(match[1]) * 60 + Number(match[2]) : null;
    };
    const start = parse(startTime);
    const end = parse(endInput);
    if (start !== null && end !== null && end > start) onDurationChange(end - start);
    else setEndDraft({ source: endTime, value: endTime });
  };
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.muted, fontSize: 10 }}>Mesmo intervalo para todos os dias ativos.</Text>
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" }}>
      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, position) => {
        const day = position + 1;
        const active = days.includes(day);
        return <View key={day} style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: position ? 1 : 0, borderTopColor: colors.border }}>
          <View style={{ width: 82, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable accessibilityRole="switch" accessibilityLabel={`${label}: ${active ? "com aula" : "sem aula"}`} accessibilityState={{ checked: active }}
              hitSlop={8} onPress={() => onDaysChange(active ? days.filter(value => value !== day) : [...days, day].sort())}
              style={{ width: 38, height: 22, borderRadius: 11, padding: 2, justifyContent: "center", backgroundColor: active ? colors.text : colors.border }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, alignSelf: active ? "flex-end" : "flex-start", backgroundColor: colors.card }} />
            </Pressable>
            <Text style={{ color: active ? colors.text : colors.muted, fontSize: 13, fontWeight: active ? "700" : "500" }}>{label}</Text>
          </View>
          {(["De", "Até"] as const).map(field => <View key={field} style={{ flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, backgroundColor: colors.inputBg, paddingHorizontal: 10, opacity: active ? 1 : 0.65 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{field}</Text>
            {active ? <TextInput accessibilityLabel={`Horário de ${field === "De" ? "início" : "término"} de ${label}`}
              value={field === "De" ? startTime : endInput} onChangeText={field === "De" ? onStartChange : value => setEndDraft({ source: endTime, value })}
              onBlur={field === "Até" ? commitEnd : undefined} maxLength={5} placeholder="HH:MM" placeholderTextColor={colors.placeholder}
              style={{ flex: 1, minWidth: 0, borderRadius: 0, paddingVertical: 0, color: colors.inputText, fontSize: 13, fontWeight: "600" }} />
              : <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 11, textAlign: "right" }}>Sem aula</Text>}
          </View>)}
        </View>;
      })}
    </View>
  </View>;
}
