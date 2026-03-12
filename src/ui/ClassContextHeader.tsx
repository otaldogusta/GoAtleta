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

const decodeUnicodeEscapes = (value: string) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const next = current
      .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );
    if (next === current) break;
    current = next;
  }
  return current;
};

const tryJsonDecode = (value: string) => {
  try {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return JSON.parse(`"${escaped}"`) as string;
  } catch {
    return value;
  }
};

const MOJIBAKE_REGEX = /[\u00c3\u00c2\ufffd]/;

const normalizeText = (value: string) => {
  if (!value) return value;
  let current = String(value);
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeUnicodeEscapes(tryJsonDecode(current));
    if (decoded === current) break;
    current = decoded;
  }
  if (/\\u[0-9a-fA-F]{4}/.test(current) || /\\U[0-9a-fA-F]{8}/.test(current)) {
    current = decodeUnicodeEscapes(current);
  }
  if (!MOJIBAKE_REGEX.test(current)) return current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      current = decodeURIComponent(escape(current));
    } catch {
      break;
    }
    if (!MOJIBAKE_REGEX.test(current)) break;
  }
  return current;
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
              backgroundColor: classPalette.bg,
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
