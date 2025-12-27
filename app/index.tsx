import { useEffect, useState } from "react";
import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { seedIfEmpty, getClasses } from "../src/db/seed";
import type { ClassGroup } from "../src/core/models";
import { Card } from "../src/ui/Card";
import { Typography } from "../src/ui/Typography";

export default function Home() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await seedIfEmpty();
      const data = await getClasses();
      if (alive) setClasses(data);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Typography variant="title">Agenda</Typography>
      <Typography variant="subtitle">Turmas de hoje</Typography>

      <FlatList
        data={classes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
        renderItem={({ item }) => (
          <Card
            title={item.name + " (" + item.ageBand + ")"}
            subtitle={
              item.daysPerWeek + "x/sem • " + item.goal + " • " + item.equipment
            }
            onPress={() => router.push("/class/" + item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}
