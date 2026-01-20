import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useRole } from "../src/auth/role";
import { createAbsenceNotice } from "../src/db/seed";
import { DateInput } from "../src/ui/DateInput";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

const reasons = ["Doenca", "Compromisso", "Lesao", "Outro"];

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function AbsenceReportScreen() {
  const { colors } = useAppTheme();
  const { student } = useRole();
  const router = useRouter();
  const [date, setDate] = useState(formatIsoDate(new Date()));
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(student?.id && student?.classId && date && reason && !busy);
  }, [busy, date, reason, student?.classId, student?.id]);

  const submit = async () => {
    if (!student?.id || !student?.classId) return;
    if (!date) {
      Alert.alert("Informe a data do treino.");
      return;
    }
    setBusy(true);
    try {
      await createAbsenceNotice({
        studentId: student.id,
        classId: student.classId,
        date,
        reason,
        note: note.trim() || undefined,
        status: "pending",
      });
      Alert.alert("Aviso enviado", "O treinador recebeu seu aviso.");
      router.back();
    } catch {
      Alert.alert("Nao foi possivel enviar o aviso.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            Avisar ausencia
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>Data do treino</Text>
          <DateInput value={date} onChange={setDate} />

          <Text style={{ color: colors.muted, fontSize: 12 }}>Motivo</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {reasons.map((item) => {
              const active = item === reason;
              return (
                <Pressable
                  key={item}
                  onPress={() => setReason(item)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryText : colors.text,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: colors.muted, fontSize: 12 }}>Mensagem (opcional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Explique rapidamente o motivo"
            placeholderTextColor={colors.placeholder}
            multiline
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              minHeight: 90,
              textAlignVertical: "top",
            }}
          />

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: canSubmit ? colors.primaryBg : colors.primaryDisabledBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              Enviar aviso
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
