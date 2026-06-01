import { Text, View } from "react-native";

import { useAppTheme, type ThemeColors } from "../../../ui/app-theme";

type StudentsOverviewCardProps = {
  organizationName: string;
  activeStudentsCount: number;
  pendingInvitesCount: number;
  todayBirthdaysCount: number;
};

export function StudentsOverviewCard({
  organizationName,
  activeStudentsCount,
  pendingInvitesCount,
  todayBirthdaysCount,
}: StudentsOverviewCardProps) {
  const { colors } = useAppTheme();

  return (
    <StudentsOverviewCardContent
      colors={colors}
      organizationName={organizationName}
      activeStudentsCount={activeStudentsCount}
      pendingInvitesCount={pendingInvitesCount}
      todayBirthdaysCount={todayBirthdaysCount}
    />
  );
}

export function StudentsOverviewCardContent({
  colors,
  organizationName,
  activeStudentsCount,
  pendingInvitesCount,
  todayBirthdaysCount,
}: StudentsOverviewCardProps & { colors: ThemeColors }) {
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
          Visão geral
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {organizationName}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {OverviewMetric({ colors, label: "Alunos ativos", value: activeStudentsCount })}
        {OverviewMetric({ colors, label: "Convites pendentes", value: pendingInvitesCount })}
        {OverviewMetric({ colors, label: "Aniversários hoje", value: todayBirthdaysCount })}
      </View>
    </View>
  );
}

function OverviewMetric({
  colors,
  label,
  value,
}: {
  colors: ThemeColors;
  label: string;
  value: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        padding: 10,
        gap: 2,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{value}</Text>
    </View>
  );
}
