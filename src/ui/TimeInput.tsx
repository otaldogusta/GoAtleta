
import { TextInput, type TextInputProps } from "react-native";
import { useAppTheme } from "./app-theme";

interface TimeInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  value: string;
  onChangeText: (value: string) => void;
  format?: "duration" | "clock";
}

/**
 * Input de tempo que formata automaticamente enquanto digita.
 * - format="duration": MM:SS (minutos:segundos) - ex: 10:00 = 10 minutos
 * - format="clock": HH:MM (horas:minutos) - ex: 14:00 = 14h
 */
export function TimeInput({ value, onChangeText, format = "duration", ...props }: TimeInputProps) {
  const { colors } = useAppTheme();

  const normalizeDurationInput = (text: string) => {
    const digits = text.replace(/[^\d]/g, "").slice(0, 4);
    if (digits.length === 0) return "";
    if (digits.length <= 2) return digits;
    
    const minutes = digits.slice(0, 2);
    let seconds = digits.slice(2);
    
    // Limitar segundos a 59
    if (seconds.length === 2) {
      const sec = parseInt(seconds, 10);
      if (sec > 59) {
        seconds = "59";
      }
    }
    
    return minutes + ":" + seconds;
  };

  const normalizeClockInput = (text: string) => {
    const digits = text.replace(/[^\d]/g, "").slice(0, 4);
    if (digits.length === 0) return "";
    if (digits.length <= 2) return digits;
    
    const hours = digits.slice(0, 2);
    let minutes = digits.slice(2);
    
    // Limitar minutos a 59 e horas a 23
    if (hours.length === 2) {
      const h = parseInt(hours, 10);
      if (h > 23) {
        return "23:";
      }
    }
    
    if (minutes.length === 2) {
      const m = parseInt(minutes, 10);
      if (m > 59) {
        minutes = "59";
      }
    }
    
    return hours + ":" + minutes;
  };

  const handleChange = (text: string) => {
    const normalized = format === "duration" ? normalizeDurationInput(text) : normalizeClockInput(text);
    onChangeText(normalized);
  };

  return (
    <TextInput
      {...props}
      value={value}
      onChangeText={handleChange}
      keyboardType="number-pad"
      maxLength={5}
      placeholderTextColor={props.placeholderTextColor ?? colors.placeholder}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          padding: 10,
          borderRadius: 10,
          backgroundColor: colors.inputBg,
          color: colors.inputText,
          fontSize: 13,
        },
        props.style,
      ]}
    />
  );
}
