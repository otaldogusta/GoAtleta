import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { saveSessionLog } from "../../../src/db/seed";
import { Button } from "../../../src/ui/Button";
import { Typography } from "../../../src/ui/Typography";

export default function LogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [rpe, setRpe] = useState<number>(7);
  const [technique, setTechnique] = useState<"boa" | "ok" | "ruim">("boa");
  const [attendance, setAttendance] = useState<number>(100);

  async function handleSave() {
    await saveSessionLog({
      classId: id,
      rpe,
      technique,
      attendance,
      createdAt: new Date().toISOString(),
    });
    router.replace("/");
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Typography variant="title">Registro pós-aula</Typography>

      <Typography variant="body">RPE (1–10): {rpe}</Typography>
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

      <Typography variant="body">Técnica geral: {technique}</Typography>
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

      <Typography variant="body">Presença (%): {attendance}</Typography>
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
    </SafeAreaView>
  );
}
