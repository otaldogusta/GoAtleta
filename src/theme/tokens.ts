export const brandPalette = {
  navy: "#0E1729",
  navyDeep: "#0A1322",
  graphite: "#162033",
  areia: "#F5F0E8",
  areiaDeep: "#EBE3D2",
  slateMuted: "#5A6B82",
  slateLight: "#8A9AB3",
  quadra: "#3DDC84",
  quadraDeep: "#27B86A",
  ambar: "#F2A03D",
  danger: "#E5484D",
  info: "#3B82F6",
  white: "#FFFFFF",
} as const;

export const semanticColors = {
  light: {
    background: brandPalette.areia,
    backgroundSubtle: "#FAF7F1",
    surface: "#FFFDF8",
    surfaceElevated: brandPalette.white,
    textPrimary: brandPalette.navy,
    textSecondary: brandPalette.graphite,
    textMuted: brandPalette.slateMuted,
    borderSubtle: "rgba(14, 23, 41, 0.12)",
    borderStrong: "rgba(14, 23, 41, 0.28)",
    primary: brandPalette.navy,
    primaryPressed: brandPalette.navyDeep,
    success: brandPalette.quadraDeep,
    warning: brandPalette.ambar,
    danger: brandPalette.danger,
    info: brandPalette.info,
  },
  dark: {
    background: brandPalette.navy,
    backgroundSubtle: brandPalette.navyDeep,
    surface: brandPalette.graphite,
    surfaceElevated: "#1B263A",
    textPrimary: "#F1F4F9",
    textSecondary: "#CBD5E1",
    textMuted: brandPalette.slateLight,
    borderSubtle: "rgba(241, 244, 249, 0.12)",
    borderStrong: "rgba(241, 244, 249, 0.26)",
    primary: brandPalette.quadra,
    primaryPressed: brandPalette.quadraDeep,
    success: brandPalette.quadra,
    warning: brandPalette.ambar,
    danger: "#F87171",
    info: "#93C5FD",
  },
} as const;

export const typography = {
  body: {
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  display: {
    fontFamily: "Inter Tight, Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  mono: {
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, Liberation Mono, monospace",
  },
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  internal: 12,
  card: 14,
  container: 16,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const shadow = {
  none: {
    shadowColor: "#000",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  card: {
    shadowColor: "#0A1322",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  elevated: {
    shadowColor: "#0A1322",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
} as const;

export const borders = {
  hairline: 1,
  focus: 2,
} as const;

export const motion = {
  durationFast: 160,
  durationBase: 240,
  durationSlow: 360,
  easingStandard: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 420,
  overlay: 3000,
  fab: 3200,
  toast: 50000,
} as const;
