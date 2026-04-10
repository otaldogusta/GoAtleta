import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import type { ClassGender } from "../core/models";
import { useAppTheme } from "./app-theme";
import { getClassPalette } from "./class-colors";
import { ClassGenderBadge } from "./ClassGenderBadge";
import { FadeHorizontalScroll } from "./FadeHorizontalScroll";
import { LocationBadge } from "./LocationBadge";
import { Pressable } from "./Pressable";
import { getUnitPalette } from "./unit-colors";
import { useIsOnline } from "../hooks/use-is-online";
import { normalizeDisplayText } from "../utils/text-normalization";

type ClassContextHeaderProps = {
  title: string;
  className: string;
  unit: string | null;
  ageBand: string | null;
  gender: ClassGender;
  dateLabel: string;
  timeLabel: string;
  notice?: string;
  classColorKey: string | null;
  scheduleFormat?: "split" | "combined";
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
  classColorKey,
  scheduleFormat = "split",
}: ClassContextHeaderProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const isOnline = useIsOnline();
  const unitLabel = unit?.trim() ?? "";
  const safeTitle = normalizeDisplayText(title);
  const safeClassName = normalizeDisplayText(className);
  const safeUnitLabel = normalizeDisplayText(unitLabel);
  const safeAgeBand = normalizeDisplayText(ageBand ?? "");
  const safeDateLabel = normalizeDisplayText(dateLabel);
  const safeTimeLabel = normalizeDisplayText(timeLabel);
  const safeNotice = normalizeDisplayText(notice ?? "");
  const unitPalette = unitLabel ? getUnitPalette(unitLabel, colors) : null;
  const classPalette = getClassPalette(classColorKey, colors, unitLabel);
  const hasCombinedSchedule = scheduleFormat === "combined" && !!dateLabel && !!timeLabel;
  const hasChips =
    !!unitLabel || !!ageBand || !!gender || !!dateLabel || !!timeLabel;

  const chipBaseStyle = {
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.secondaryBg,
    justifyContent: "center" as const,
  };

  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/");
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          {safeTitle ? (
            <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
              {safeTitle}
            </Text>
          ) : null}
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: isOnline ? classPalette.bg : colors.border,
              opacity: isOnline ? 1 : 0.45,
            }}
          />
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "700", color: colors.text, maxWidth: 140 }}>
            {safeClassName}
          </Text>
          {gender ? <ClassGenderBadge gender={gender} size="md" /> : null}
        </View>
      </View>
      {hasChips ? (
        <FadeHorizontalScroll
          fadeColor={colors.background}
          contentContainerStyle={{ flexDirection: "row", gap: 8 }}
        >
          {unitPalette ? (
            <LocationBadge
              location={safeUnitLabel}
              palette={unitPalette}
              size="md"
              showIcon={true}
            />
          ) : null}
          {ageBand ? (
            <View
              style={[chipBaseStyle, { borderRadius: 999 }]}
            >
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
                {"Faixa " + safeAgeBand}
              </Text>
            </View>
          ) : null}
          {hasCombinedSchedule ? (
            <View
              style={chipBaseStyle}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                {"Próxima sessão: " + safeDateLabel + " às " + safeTimeLabel}
              </Text>
            </View>
          ) : dateLabel ? (
            <View
              style={chipBaseStyle}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                {"Data: " + safeDateLabel}
              </Text>
            </View>
          ) : null}
          {!hasCombinedSchedule && timeLabel ? (
            <View
              style={chipBaseStyle}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                {"Horário: " + safeTimeLabel}
              </Text>
            </View>
          ) : null}
        </FadeHorizontalScroll>
      ) : null}
      {safeNotice ? (
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
          <Text style={{ color: colors.muted, fontSize: 12 }}>{safeNotice}</Text>
        </View>
      ) : null}
    </View>
  );
}
