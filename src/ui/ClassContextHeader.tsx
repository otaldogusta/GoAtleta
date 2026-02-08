import { Text, View } from "react-native";
import type { ClassGender } from "../core/models";
import { useAppTheme } from "./app-theme";
import { getClassPalette } from "./class-colors";
import { getUnitPalette } from "./unit-colors";
import { ClassGenderBadge } from "./ClassGenderBadge";
import { FadeHorizontalScroll } from "./FadeHorizontalScroll";

const decodeUnicodeEscapes = (value: string) =>
  value.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

const normalizeText = (value: string) => {
  if (!value) return value;
  const decoded = decodeUnicodeEscapes(value);
  if (!/\\u00[0-9a-fA-F]{2}|[ÃÂ�]/.test(decoded)) return decoded;
  try {
    const fixed = decodeURIComponent(escape(decoded));
    return /[ÃÂ�]/.test(fixed) ? decoded : fixed;
  } catch {
    return decoded;
  }
};

type ClassContextHeaderProps = {
  title: string;
  className: string;
  unit: string | null;
  ageBand: string | null;
  gender: ClassGender;
  dateLabel: string;
  timeLabel: string;
  notice: string;
  classColorKey: string | null;
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
}: ClassContextHeaderProps) {
  const { colors } = useAppTheme();
  const unitLabel = unit?.trim() ?? "";
  const safeTitle = normalizeText(title);
  const safeClassName = normalizeText(className);
  const safeUnitLabel = normalizeText(unitLabel);
  const safeAgeBand = normalizeText(ageBand ?? "");
  const safeDateLabel = normalizeText(dateLabel);
  const safeTimeLabel = normalizeText(timeLabel);
  const safeNotice = normalizeText(notice);
  const unitPalette = unitLabel ? getUnitPalette(unitLabel, colors) : null;
  const classPalette = getClassPalette(classColorKey, colors, unitLabel);
  const hasChips =
    !!unitLabel || !!ageBand || !!gender || !!dateLabel || !!timeLabel;

  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {safeTitle ? (
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
          {safeTitle}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: classPalette.bg,
          }}
        />
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
          {safeClassName}
        </Text>
      </View>
      {hasChips ? (
        <FadeHorizontalScroll
          fadeColor={colors.background}
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
                {safeUnitLabel}
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
                {"Faixa " + safeAgeBand}
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
                {"Data: " + safeDateLabel}
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

