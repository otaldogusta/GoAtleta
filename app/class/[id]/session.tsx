import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { getClassById } from "../../../src/db/seed";
import type { ClassGroup } from "../../../src/core/models";
import { generateSession } from "../../../src/core/sessionGenerator";
import { Typography } from "../../../src/ui/Typography";
import { Card } from "../../../src/ui/Card";

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const session = useMemo(() => {
    if (!cls) return null;
    return generateSession(cls);
  }, [cls]);

  if (!cls || !session) return null;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Typography variant="title">Aula do dia</Typography>
      <Typography variant="subtitle">
        {cls.name} • {session.block}
      </Typography>

      <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 12 }}>
        <Card title="Aquecimento (10 min)" subtitle={session.warmup.join(" • ")} />
        <Card title="Parte principal (45 min)" subtitle={session.main.join(" • ")} />
        <Card title="Volta à calma (5 min)" subtitle={session.cooldown.join(" • ")} />
      </ScrollView>
    </SafeAreaView>
  );
}
