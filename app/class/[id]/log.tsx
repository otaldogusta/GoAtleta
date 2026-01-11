import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { getTrainingPlans, saveSessionLog } from "../../../src/db/seed";
import { Button } from "../../../src/ui/Button";
import { useAppTheme } from "../../../src/ui/app-theme";

export default function LogScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();

  const [PSE, setPSE] = useState<number>(7);
  const [technique, setTechnique] = useState<"boa" | "ok" | "ruim">("boa");
  const [attendance, setAttendance] = useState<number>(100);
  const [activity, setActivity] = useState("");
  const [autoActivity, setAutoActivity] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [participantsCount, setParticipantsCount] = useState("");
  const [photos, setPhotos] = useState("");

  const sessionDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);
  const weekdayId = useMemo(() => {
    const dateObj = new Date(sessionDate);
    const day = dateObj.getDay();
    return day === 0 ? 7 : day;
  }, [sessionDate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      const plans = await getTrainingPlans();
      const byClass = plans.filter((item) => item.classId === id);
      const byDate = byClass.find((item) => item.applyDate === sessionDate);
      const byWeekday = byClass.find((item) =>
        (item.applyDays ?? []).includes(weekdayId)
      );
      const plan = byDate ?? byWeekday ?? null;
      if (!plan) return;
      const fallback =
        plan.title?.trim() ||
        plan.main?.filter(Boolean).slice(0, 2).join(" / ") ||
        "";
      if (!fallback) return;
      if (!alive) return;
      setAutoActivity(fallback);
      if (!activity.trim()) setActivity(fallback);
    })();
    return () => {
      alive = false;
    };
  }, [activity, id, sessionDate, weekdayId]);

  const saveLog = async () => {
    const dateValue =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
    const createdAt = dateValue
      ? new Date(`${dateValue}T12:00:00`).toISOString()
      : new Date().toISOString();
    const participantsRaw = participantsCount.trim();
    const participantsValue = participantsRaw ? Number(participantsRaw) : Number.NaN;
    const parsedParticipants =
      Number.isFinite(participantsValue) && participantsValue >= 0
        ? participantsValue
        : undefined;
    const activityValue = activity.trim() || autoActivity.trim();
    await saveSessionLog({
      classId: id,
      PSE,
      technique,
      attendance,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants,
      photos,
      createdAt,
    });
    return dateValue ?? new Date().toISOString().slice(0, 10);
  };

  async function handleSave() {
    await saveLog();
    router.replace("/");
  }

  async function handleSaveAndReport() {
    const reportDate = await saveLog();
    router.replace({
      pathname: "/class/[id]/session",
      params: { id, date: reportDate, autoReport: "1" },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ gap: 6, marginBottom: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Registro pos-aula
          </Text>
          <Text style={{ color: colors.muted }}>Avaliacao rapida da aula</Text>
        </View>

        <View
          style={{
            gap: 10,
            padding: 16,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            PSE (0-10): {PSE}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <Button
                key={n}
                label={String(n)}
                onPress={() => setPSE(n)}
                variant={PSE === n ? "primary" : "secondary"}
              />
            ))}
          </View>

          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            Tecnica geral: {technique}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
            {(["boa", "ok", "ruim"] as const).map((t) => (
              <Button
                key={t}
                label={t}
                onPress={() => setTechnique(t)}
                variant={technique === t ? "primary" : "secondary"}
              />
            ))}
          </View>

          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            Presenca (%): {attendance}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
            {[60, 80, 100].map((n) => (
              <Button
                key={n}
                label={String(n)}
                onPress={() => setAttendance(n)}
                variant={attendance === n ? "primary" : "secondary"}
              />
            ))}
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Numero de participantes
            </Text>
            <TextInput
              placeholder="Ex: 12"
              value={participantsCount}
              onChangeText={setParticipantsCount}
              keyboardType="numeric"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Atividade
            </Text>
            <TextInput
              placeholder="Resumo da atividade principal"
              value={activity}
              onChangeText={setActivity}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Conclusao
            </Text>
            <TextInput
              placeholder="Observacoes finais da aula"
              value={conclusion}
              onChangeText={setConclusion}
              placeholderTextColor={colors.placeholder}
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 12,
                minHeight: 90,
                textAlignVertical: "top",
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Fotos (links ou notas)
            </Text>
            <TextInput
              placeholder="Cole links ou descreva as fotos"
              value={photos}
              onChangeText={setPhotos}
              placeholderTextColor={colors.placeholder}
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 12,
                minHeight: 80,
                textAlignVertical: "top",
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>

          <View style={{ marginTop: 16, gap: 8 }}>
            <Button label="Salvar e gerar relatorio" onPress={handleSaveAndReport} />
            <Button label="Salvar" variant="secondary" onPress={handleSave} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


