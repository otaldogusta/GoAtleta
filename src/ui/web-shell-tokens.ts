/**
 * Web Shell Visual Tokens
 * BankDash clean language for professional dashboard experience
 * Used only on web (>= 1200px). Mobile/tablet use app theme colors.
 */

export const webShellTokens = {
  // Page & Surface
  background: "#F3F5F7",
  surface: "#FFFFFF",
  surfaceSoft: "#FAFBFC",
  surfaceAlt: "#F8FAFC",

  // Sidebar
  sidebar: "#0F172A",
  sidebarSoft: "rgba(255,255,255,0.08)",
  sidebarHover: "rgba(255,255,255,0.12)",
  sidebarActive: "rgba(255,255,255,0.06)",

  // Typography
  text: "#0F172A",
  textSecondary: "#475569",
  muted: "#64748B",
  mutedLight: "#94A3B8",

  // Primary (Green)
  primary: "#3F6F5A",
  primaryHover: "#355E4C",
  primaryLight: "#4A8269",
  primarySoft: "rgba(63, 111, 90, 0.08)",
  primarySoftBg: "#E7F1EC",

  // Accent (Amber for location)
  accent: "#D97706",
  accentLight: "#F59E0B",
  accentSoft: "rgba(217, 119, 6, 0.08)",
  accentSoftBg: "#FEF3C7",

  // UI Elements
  border: "#E6E8EC",
  borderLight: "#EEF2F5",
  borderSoft: "rgba(15, 23, 42, 0.04)",
  divider: "#E2E8F0",

  // Shadows
  shadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
  shadowSoft: "0 6px 18px rgba(15, 23, 42, 0.04)",
  shadowXs: "0 2px 8px rgba(15, 23, 42, 0.03)",

  // State
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Overlay
  scrim: "rgba(15, 23, 42, 0.50)",
} as const;

export type WebShellTokens = typeof webShellTokens;
