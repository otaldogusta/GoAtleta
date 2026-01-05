import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { saveSessionLog } from "../../../src/db/seed";
import { Button } from "../../../src/ui/Button";
import { useAppTheme } from "../../../src/ui/app-theme";

export default function LogScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();

  const [rpe, setRpe] = useState<number>(7);
  const [technique, setTechnique] = useState<"boa" | "ok" | "ruim">("boa");
  const [attendance, setAttendance] = useState<number>(100);

  async function handleSave() {
    const dateValue =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
    const createdAt = dateValue
      ? new Date(`${dateValue}T12:00:00`).toISOString()
      : new Date().toISOString();
    await saveSessionLog({
      classId: id,
      rpe,
      technique,
      attendance,
      createdAt,
    });
    router.replace("/");
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
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
          RPE (1-10): {rpe}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
          {[5, 6, 7, 8, 9].map((n) => (
            <Button
              key={n}
              label={String(n)}
              onPress={() => setRpe(n)}
              variant={rpe === n ? "primary" : "secondary"}
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

        <View style={{ marginTop: 16 }}>
          <Button label="Salvar" onPress={handleSave} />
        </View>
      </View>
    </SafeAreaView>
  );
}


