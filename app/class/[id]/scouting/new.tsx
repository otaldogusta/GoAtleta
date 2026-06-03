import { Redirect, useLocalSearchParams } from "expo-router";

export default function NewClassScoutingRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Redirect
      href={{
        pathname: "/class/[id]/scouting",
        params: { id },
      }}
    />
  );
}
