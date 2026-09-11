import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";
import { typography } from "../theme/tokens";

type NativeDateInputProps = {
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
};

const formatIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

const formatTypedDate = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseTypedDate = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export function NativeDateInput({ accessibilityLabel, value, onChangeText }: NativeDateInputProps) {
  const { colors, mode } = useAppTheme();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState(() => formatIsoDate(value));

  useEffect(() => {
    setDisplayValue(formatIsoDate(value));
  }, [value]);

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;

    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  };

  return (
    <div style={{ display: "flex", flex: 1, minWidth: 0, position: "relative" }}>
      <input
        aria-label={accessibilityLabel}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={displayValue}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const nextDisplayValue = formatTypedDate(event.currentTarget.value);
          setDisplayValue(nextDisplayValue);

          if (!nextDisplayValue) {
            onChangeText("");
            return;
          }

          const nextIsoValue = parseTypedDate(nextDisplayValue);
          if (nextIsoValue) onChangeText(nextIsoValue);
        }}
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          height: 48,
          paddingRight: 42,
          border: 0,
          borderRadius: 0,
          outline: "none",
          background: "transparent",
          color: colors.text,
          fontFamily: typography.body.fontFamily,
          fontSize: 15,
        }}
      />
      <button
        type="button"
        aria-label="Abrir calendário"
        onClick={openPicker}
        style={{
          position: "absolute",
          right: 2,
          top: 4,
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: 0,
          borderRadius: 20,
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <GoAtletaIcon name="calendar" size={18} color={colors.muted} />
      </button>
      <input
        ref={pickerRef}
        aria-hidden="true"
        tabIndex={-1}
        type="date"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeText(event.currentTarget.value)}
        style={{
          position: "absolute",
          right: 20,
          bottom: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          colorScheme: mode,
        }}
      />
    </div>
  );
}
