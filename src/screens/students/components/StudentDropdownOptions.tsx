import { memo } from "react";
import { Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { useAppTheme, type ThemeColors } from "../../../ui/app-theme";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { GoAtletaIcon } from "../../../ui/icon-registry";

export type StudentSelectOptionProps = {
  label: string;
  value: string;
  active: boolean;
  onSelect: (value: string) => void;
  isFirst: boolean;
};

export type StudentClassOptionProps = {
  item: ClassGroup;
  active: boolean;
  onSelect: (value: ClassGroup) => void;
  isFirst: boolean;
  compact?: boolean;
};

export type StudentMultiSelectOptionProps = {
  label: string;
  value: string;
  active: boolean;
  onToggle: (value: string) => void;
  isFirst: boolean;
  compact?: boolean;
};

export const StudentSelectOption = memo(function StudentSelectOption(
  props: StudentSelectOptionProps
) {
  const { colors } = useAppTheme();

  return <StudentSelectOptionContent colors={colors} {...props} />;
});

export function StudentSelectOptionContent({
  colors,
  label,
  value,
  active,
  onSelect,
}: StudentSelectOptionProps & { colors: ThemeColors }) {
  return (
    <AnchoredDropdownOption active={active} onPress={() => onSelect(value)}>
      <Text
        style={{
          color: active ? colors.primaryText : colors.text,
          fontSize: 14,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </AnchoredDropdownOption>
  );
}

export const StudentMultiSelectOption = memo(function StudentMultiSelectOption(
  props: StudentMultiSelectOptionProps
) {
  const { colors } = useAppTheme();

  return <StudentMultiSelectOptionContent colors={colors} {...props} />;
});

export function StudentMultiSelectOptionContent({
  colors,
  label,
  value,
  active,
  onToggle,
  compact = false,
}: StudentMultiSelectOptionProps & { colors: ThemeColors }) {
  return (
    <AnchoredDropdownOption
      active={active}
      onPress={() => onToggle(value)}
      style={{
        paddingVertical: compact ? 9 : 12,
        paddingHorizontal: compact ? 10 : 12,
        borderRadius: compact ? 12 : 14,
        marginVertical: compact ? 1 : 3,
      }}
      rightAccessory={
        <GoAtletaIcon
          name={active ? "checkbox" : "square"}
          size={compact ? 16 : 18}
          color={active ? colors.primaryText : colors.muted}
        />
      }
    >
      <Text
        style={{
          color: active ? colors.primaryText : colors.text,
          fontSize: compact ? 13 : 14,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </AnchoredDropdownOption>
  );
}

export const StudentClassOption = memo(function StudentClassOption(
  props: StudentClassOptionProps
) {
  const { colors } = useAppTheme();

  return <StudentClassOptionContent colors={colors} {...props} />;
});

export function StudentClassOptionContent({
  colors,
  item,
  active,
  onSelect,
  compact = false,
}: StudentClassOptionProps & { colors: ThemeColors }) {
  return (
    <AnchoredDropdownOption
      active={active}
      onPress={() => onSelect(item)}
      style={{
        paddingVertical: compact ? 9 : 12,
        paddingHorizontal: compact ? 10 : 12,
        borderRadius: compact ? 12 : 14,
        marginVertical: compact ? 1 : 3,
      }}
      rightAccessory={<ClassGenderBadge gender={item.gender} />}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Text
          style={{
            color: active ? colors.primaryText : colors.text,
            fontSize: compact ? 13 : 14,
            fontWeight: active ? "700" : "500",
          }}
        >
          {formatStudentClassOptionTitle(item)}
        </Text>
      </View>
      <Text
        style={{
          color: active ? colors.primaryText : colors.muted,
          fontSize: compact ? 11 : 12,
          marginTop: 2,
        }}
      >
        {formatStudentClassOptionUnit(item.unit)}
      </Text>
    </AnchoredDropdownOption>
  );
}

function formatStudentClassOptionTitle(cls: ClassGroup) {
  const start = cls.startTime || "";
  const duration = cls.durationMinutes || 60;
  const timeRange = start ? formatTimeRange(start, duration) : "";
  if (timeRange) return `${timeRange} - ${cls.name}`;
  return cls.name;
}

function formatStudentClassOptionUnit(value: string) {
  return value && value.trim() ? value.trim() : "Sem unidade";
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeRange(startTime: string, durationMinutes: number) {
  const parsed = parseTime(startTime);
  if (!parsed) return "";
  const total = parsed.hour * 60 + parsed.minute + durationMinutes;
  const endHour = Math.floor(total / 60) % 24;
  const endMinute = total % 60;
  return `${formatTime(parsed.hour, parsed.minute)} - ${formatTime(endHour, endMinute)}`;
}
