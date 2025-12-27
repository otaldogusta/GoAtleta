import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { getClassById } from "../../src/db/seed";
import type { ClassGroup } from "../../src/core/models";
import { Button } from "../../src/ui/Button";
import { Typography } from "../../src/ui/Typography";

export default function ClassDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cls, setCls] = useState<ClassGroup | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClassById(id);
      if (alive) setCls(data);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!cls) return null;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Typography variant="title">{cls.name}</Typography>
      <Typography variant="subtitle">Faixa: {cls.ageBand}</Typography>
      <Typography variant="body">
        Frequência: {cls.daysPerWeek}x/sem • Objetivo: {cls.goal}
      </Typography>

      <View style={{ marginTop: 20, gap: 12 }}>
        <Button
          label="Ver aula do dia"
          onPress={() => router.push("/class/" + id + "/session")}
        />
        <Button
          label="Registrar pós-aula"
          onPress={() => router.push("/class/" + id + "/log")}
          variant="secondary"
        />
      </View>
    </SafeAreaView>
  );
}
