import { Text, View } from "react-native";

import { BackTitleHeader } from "../../../components/ui/BackTitleHeader";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { LocationBadge } from "../../../ui/LocationBadge";
import type { ClassGender } from "../../../core/models";
import type { UnitPalette } from "../../../ui/unit-colors";
import type { ThemeColors } from "../../../ui/app-theme";

type Props = {
  title: string;
  colors: ThemeColors;
  classAgeBand: string;
  classGender: ClassGender;
  classPalette: UnitPalette;
  location: string;
  showNoPlanNotice: boolean;
  noPlanNotice: string;
  onBack: () => void;
};

export function SessionTopHeader({
  title,
  colors,
  classAgeBand,
  classGender,
  classPalette,
  location,
  showNoPlanNotice,
  noPlanNotice,
  onBack,
}: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <View style={{ flex: 1, gap: 8 }}>
        <BackTitleHeader title={title} onBack={onBack} style={{ marginBottom: 0 }} />
        {showNoPlanNotice ? (
          <Text style={{ color: colors.warningText, fontSize: 12 }}>
            {noPlanNotice}
          </Text>
        ) : null}
      </View>

      <View style={{ alignItems: "flex-end", gap: 6, minWidth: 120 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: classPalette.bg }} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            Turma {classAgeBand || "-"}
          </Text>
          <ClassGenderBadge gender={classGender} size="md" />
        </View>
        <LocationBadge
          location={location}
          palette={classPalette}
          size="sm"
          showIcon={false}
        />
      </View>
    </View>
  );
}
