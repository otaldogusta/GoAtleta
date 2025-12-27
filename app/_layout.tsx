import { useEffect } from "react";
import { Stack } from "expo-router";

import { initDb } from "../src/db/sqlite";

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
      }}
    />
  );
}
