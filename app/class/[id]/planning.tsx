import { Redirect, useLocalSearchParams } from "expo-router";

const getCurrentMonthKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

export default function ClassPlanningHubRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = typeof id === "string" ? id : "";

  return (
    <Redirect
      href={{
        pathname: "/class/[id]/planning/[month]",
        params: { id: classId, month: getCurrentMonthKey() },
      }}
    />
  );
}
