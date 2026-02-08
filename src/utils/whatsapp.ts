import { Linking, Platform } from "react-native";
import type { Student } from "../core/models";

export type PhoneNormalization = {
  phoneDigits: string; // E.164-like digits for BR: 55 + DDD + número
  isValid: boolean;
};

export function normalizePhoneBR(raw: string | null): PhoneNormalization {
  if (!raw || !String(raw).trim()) return { phoneDigits: "", isValid: false };
  const onlyDigits = String(raw).replace(/\D/g, "");
  const withoutCountry = onlyDigits.startsWith("55") ? onlyDigits.slice(2) : onlyDigits;
  // BR: 10-11 digits (DDD + número)
  if (withoutCountry.length < 10 || withoutCountry.length > 11) {
    return { phoneDigits: "", isValid: false };
  }
  return { phoneDigits: `55${withoutCountry}`, isValid: true };
}

export type ContactResult = {
  phoneDigits: string; // 55 + DDD + número
  source: "guardian" | "student" | null;
  status: "ok" | "invalid" | "missing";
};

export function getContactPhone(student: Student): ContactResult {
  const guardian = normalizePhoneBR(student.guardianPhone);
  if (guardian.isValid) {
    return { phoneDigits: guardian.phoneDigits, source: "guardian", status: "ok" };
  }
  const studentNorm = normalizePhoneBR(student.phone);
  if (studentNorm.isValid) {
    return { phoneDigits: studentNorm.phoneDigits, source: "student", status: "ok" };
  }
  const hasAny = !!(student.guardianPhone || student.phone);
  return { phoneDigits: "", source: null, status: hasAny ? "invalid" : "missing" };
}

export function buildWaMeLink(waDigits: string, text: string): string {
  const base = `https://wa.me/${String(waDigits).replace(/\D/g, "")}`;
  if (text && text.length) {
    return `${base}?text=${encodeURIComponent(text)}`;
  }
  return base;
}

export async function openWhatsApp(url: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.open) {
        window.open(url, "_blank");
        return;
      }
    }
    await Linking.openURL(url);
  } catch (err) {
    // No-op; callers can present alerts as needed
  }
}

/**
 * Build default WhatsApp message.
 * This is a version that uses env only (for non-React contexts).
 * In React components, use getDefaultMessageWithSettings() instead.
 */
export function getDefaultMessage(
  type: "global" | "student",
  options: {
    className: string;
    unitLabel: string;
    role: "guardian" | "student" | null;
    date: string;
    enabledOverride: boolean; // For runtime toggle
  }
): string {
  // Check if explicitly enabled/disabled via override
  const enabled = options.enabledOverride !== undefined ? options.enabledOverride : _checkEnvEnabled();
  
  if (!enabled) {
    return "";
  }

  if (type === "global") {
    return `Olá! Sou o professor Gustavo da turma ${options.className || ""} (${options.unitLabel || ""}).`;
  }
  if (type === "student") {
    const roleLabel = options.role === "guardian" ? "Responsável" : "Aluno";
    return `Olá, ${roleLabel}! Sou o treinador da turma ${options.className || ""}. (${options.date || ""}).`;
  }
  return "";
}

function _checkEnvEnabled(): boolean {
  const envValue = typeof process !== "undefined" && process.env.EXPO_PUBLIC_WHATSAPP_DEFAULT_TEXT;
  if (!envValue || envValue === "false" || envValue === "disabled") {
    return false;
  }
  return envValue === "true" || envValue === "default";
}
