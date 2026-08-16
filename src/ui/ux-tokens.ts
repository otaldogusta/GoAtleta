import { borders, brandPalette, motion, radius, semanticColors, shadow, spacing, typography } from "../theme/tokens";

export const ref = {
  color: {
    brand: {
      navy: brandPalette.navy,
      navyDeep: brandPalette.navyDeep,
      quadra: brandPalette.quadra,
      quadraDeep: brandPalette.quadraDeep,
      ambar: brandPalette.ambar,
    },
    neutral: {
      white: brandPalette.white,
      areia: brandPalette.areia,
      areiaDeep: brandPalette.areiaDeep,
      graphite: brandPalette.graphite,
      slateMuted: brandPalette.slateMuted,
      slateLight: brandPalette.slateLight,
    },
    status: {
      danger: brandPalette.danger,
      info: brandPalette.info,
    },
  },
  space: {
    25: 2,
    50: 4,
    75: 6,
    100: spacing.xs,
    150: spacing.sm,
    200: spacing.md,
    250: spacing.lg,
    300: spacing.xl,
    400: spacing.xxl,
    500: 40,
    600: 48,
    800: 64,
    1000: 80,
  },
  font: {
    family: typography,
    size: {
      caption: 12,
      body: 14,
      bodyLarge: 16,
      title: 20,
      titleLarge: 24,
    },
    lineHeight: {
      caption: 16,
      body: 20,
      bodyLarge: 24,
      title: 24,
      titleLarge: 28,
    },
  },
  radius: {
    xs: 4,
    sm: 6,
    control: radius.internal,
    card: radius.card,
    container: radius.container,
    modal: radius.xl,
    full: radius.full,
  },
  elevation: {
    default: shadow.none,
    raised: shadow.card,
    overlay: shadow.elevated,
  },
  border: borders,
  motion,
} as const;

export const sys = {
  light: {
    color: {
      background: semanticColors.light.background,
      backgroundSubtle: semanticColors.light.backgroundSubtle,
      surface: semanticColors.light.surface,
      surfaceRaised: semanticColors.light.surfaceElevated,
      textPrimary: semanticColors.light.textPrimary,
      textSecondary: semanticColors.light.textSecondary,
      textMuted: semanticColors.light.textMuted,
      borderSubtle: semanticColors.light.borderSubtle,
      borderStrong: semanticColors.light.borderStrong,
      actionPrimary: semanticColors.light.primary,
      actionPrimaryPressed: semanticColors.light.primaryPressed,
      statusSuccess: semanticColors.light.success,
      statusWarning: semanticColors.light.warning,
      statusDanger: semanticColors.light.danger,
      statusInfo: semanticColors.light.info,
    },
  },
  dark: {
    color: {
      background: semanticColors.dark.background,
      backgroundSubtle: semanticColors.dark.backgroundSubtle,
      surface: semanticColors.dark.surface,
      surfaceRaised: semanticColors.dark.surfaceElevated,
      textPrimary: semanticColors.dark.textPrimary,
      textSecondary: semanticColors.dark.textSecondary,
      textMuted: semanticColors.dark.textMuted,
      borderSubtle: semanticColors.dark.borderSubtle,
      borderStrong: semanticColors.dark.borderStrong,
      actionPrimary: semanticColors.dark.primary,
      actionPrimaryPressed: semanticColors.dark.primaryPressed,
      statusSuccess: semanticColors.dark.success,
      statusWarning: semanticColors.dark.warning,
      statusDanger: semanticColors.dark.danger,
      statusInfo: semanticColors.dark.info,
    },
  },
  space: {
    stackXs: ref.space[50],
    stackSm: ref.space[100],
    stackMd: ref.space[200],
    stackLg: ref.space[300],
    stackXl: ref.space[400],
    insetControl: ref.space[150],
    insetCard: ref.space[200],
    insetSection: ref.space[300],
  },
  radius: {
    control: ref.radius.control,
    card: ref.radius.card,
    modal: ref.radius.modal,
    pill: ref.radius.full,
  },
  elevation: ref.elevation,
} as const;

export const cmp = {
  card: {
    padding: {
      sm: ref.space[150],
      md: ref.space[200],
      lg: ref.space[300],
    },
    gap: {
      sm: ref.space[100],
      md: ref.space[150],
      lg: ref.space[200],
    },
    radius: sys.radius.card,
    elevation: sys.elevation.default,
  },
  tabs: {
    padding: ref.space[75],
    itemMinHeight: 36,
    radius: sys.radius.pill,
    indicatorHeight: 2,
  },
  badge: {
    paddingX: ref.space[100],
    paddingY: ref.space[50],
    radius: sys.radius.pill,
    minHeight: 24,
  },
  button: {
    paddingX: ref.space[200],
    paddingY: ref.space[150],
    radius: sys.radius.control,
    minHeight: 44,
  },
  modal: {
    radius: sys.radius.modal,
    maxWidthSm: 520,
    maxWidthMd: 760,
    maxWidthLg: 1080,
  },
  emptyState: {
    iconSize: 36,
    gap: ref.space[150],
  },
} as const;

export type UxTokens = {
  ref: typeof ref;
  sys: typeof sys;
  cmp: typeof cmp;
};
