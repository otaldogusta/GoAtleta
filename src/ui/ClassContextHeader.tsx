import { ScrollView, Text, View } from "react-native";
import type { ClassGender } from "../core/models";
import { useAppTheme } from "./app-theme";
import { getUnitPalette } from "./unit-colors";
import { ClassGenderBadge } from "./ClassGenderBadge";

type ClassContextHeaderProps = {
  title?: string;
  className: string;
  unit?: string | null;
  ageBand?: string | null;
  gender?: ClassGender;
  dateLabel?: string;
  timeLabel?: string;
  notice?: string;
};

export function ClassContextHeader({
  title,
  className,
  unit,
  ageBand,
  gender,
  dateLabel,
  timeLabel,
  notice,
}: ClassContextHeaderProps) {
  const { colors } = useAppTheme();
  const unitLabel = unit?.trim();
  const unitPalette = unitLabel ? getUnitPalette(unitLabel, colors) : null;
  const hasChips =
    !!unitLabel || !!ageBand || !!gender || !!dateLabel || !!timeLabel;

  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {title ? (
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
          {title}
        </Text>
      ) : null}
      <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
        {className}
      </Text>
      {hasChips ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: "row", gap: 8 }}
        >
          {unitPalette ? (
            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: unitPalette.bg,
              }}
            >
              <Text style={{ color: unitPalette.text, fontWeight: "600", fontSize: 12 }}>
                {unitLabel}
              </Text>
            </View>
          ) : null}
          {ageBand ? (
            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
                {"Faixa " + ageBand}
              </Text>
            </View>
          ) : null}
          {gender ? <ClassGenderBadge gender={gender} size="md" /> : null}
          {dateLabel ? (
            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                {"Data: " + dateLabel}
              </Text>
            </View>
          ) : null}
          {timeLabel ? (
            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                {"Horário: " + timeLabel}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
      {notice ? (
        <View
          style={{
            marginTop: 6,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}
