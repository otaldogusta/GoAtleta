import { useEffect, useRef, useState, type Ref } from "react";
import {
    Platform,
    TextInput,
    type TextInputProps,
    View,
} from "react-native";
import { Pressable } from "./Pressable";

import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";

export const formatShortDate = (value: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

export const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const parseDateInputToIso = (value: string) => {
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

export type DateInputProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  onOpenCalendar?: () => void;
  invalid?: boolean;
  onFocus?: TextInputProps["onFocus"];
  onBlur?: TextInputProps["onBlur"];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  inputRef?: Ref<TextInput>;
};

function DateInputField({
  value,
  onChange,
  placeholder = "Selecione a data",
  onOpenCalendar,
  invalid = false,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
  inputRef,
}: DateInputProps) {
  const { colors, mode } = useAppTheme();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value ? formatShortDate(value) : "");
  useEffect(() => {
    // Synchronize external date changes without remounting the focused field.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(formatShortDate(value));
  }, [value]);
  const canOpenCalendar = Boolean(onOpenCalendar) || Platform.OS === "web";
  const openCalendar = () => {
    if (onOpenCalendar) {
      onOpenCalendar();
      return;
    }
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  };

  const commitInputValue = () => {
    if (!inputValue) {
      if (value) onChange("");
      return;
    }

    const formatted = formatDateInput(inputValue);
    const iso = parseDateInputToIso(formatted);
    if (!iso) {
      setInputValue(formatShortDate(value));
      return;
    }

    setInputValue(formatted);
    if (iso !== value) onChange(iso);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: invalid ? 2 : 1,
        borderColor: invalid ? colors.dangerSolidBg : colors.border,
        borderRadius: 12,
        backgroundColor: colors.inputBg,
        paddingHorizontal: 14,
        overflow: "hidden",
        minHeight: 50,
        position: "relative",
      }}
    >
      <TextInput
        ref={inputRef}
        placeholder={placeholder}
        value={inputValue}
        onChangeText={(text) => {
          // Preserve the caret and partially edited day/month/year until commit.
          setInputValue(text);
        }}
        onBlur={(event) => {
          commitInputValue();
          onBlur?.(event);
        }}
        onSubmitEditing={commitInputValue}
        keyboardType="numeric"
        onFocus={onFocus}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityHint={accessibilityHint}
        placeholderTextColor={colors.placeholder}
        style={{
          flex: 1,
          borderRadius: 0,
          paddingVertical: 12,
          paddingRight: 36,
          color: colors.inputText,
          backgroundColor: "transparent",
        }}
      />
      <Pressable
        accessibilityLabel={`Abrir calendário: ${accessibilityLabel ?? placeholder}`}
        onPress={openCalendar}
        disabled={!canOpenCalendar}
        style={{
          position: "absolute",
          right: 6,
          top: 0,
          bottom: 0,
          width: 32,
          alignItems: "center",
          justifyContent: "center",
          opacity: canOpenCalendar ? 1 : 0.45,
        }}
      >
        <GoAtletaIcon
          name="calendar"
          size={18}
          color={canOpenCalendar ? colors.muted : colors.placeholder}
        />
      </Pressable>
      {Platform.OS === "web" && !onOpenCalendar ? (
        <input
          ref={pickerRef}
          type="date"
          value={value}
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setInputValue(formatShortDate(next));
            onChange(next);
          }}
          style={{
            position: "absolute", right: 20, bottom: 0, width: 1, height: 1,
            opacity: 0, pointerEvents: "none", colorScheme: mode,
          }}
        />
      ) : null}
    </View>
  );
}

export function DateInput(props: DateInputProps) {
  return <DateInputField {...props} />;
}
