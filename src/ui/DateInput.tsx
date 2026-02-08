import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    TextInput,
    View,
} from "react-native";
import { Pressable } from "./Pressable";

import { useAppTheme } from "./app-theme";

const formatShortDate = (value: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseDateInputToIso = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!day || !month || !year) return null;
  if (month < 1 || month > 12) return null;
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}`;
};

export function DateInput({
  value,
  onChange,
  placeholder = "Selecione a data",
  onOpenCalendar,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  onOpenCalendar: () => void;
}) {
  const { colors } = useAppTheme();
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setInputValue(value ? formatShortDate(value) : "");
  }, [value]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.inputBg,
        paddingHorizontal: 12,
        overflow: "hidden",
        minHeight: 44,
        position: "relative",
      }}
    >
      <TextInput
        placeholder={placeholder}
        value={inputValue}
        onChangeText={(text) => {
          const formatted = formatDateInput(text);
          setInputValue(formatted);
          if (!formatted) {
            onChange("");
            return;
          }
          const iso = parseDateInputToIso(formatted);
          if (iso) {
            onChange(iso);
          }
        }}
        keyboardType="numeric"
        placeholderTextColor={colors.placeholder}
        style={{
          flex: 1,
          paddingVertical: 12,
          paddingRight: 36,
          color: colors.inputText,
          backgroundColor: "transparent",
        }}
      />
      <Pressable
        onPress={onOpenCalendar}
        style={{
          position: "absolute",
          right: 6,
          top: 0,
          bottom: 0,
          width: 32,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}
