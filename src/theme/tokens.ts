export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  full: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
