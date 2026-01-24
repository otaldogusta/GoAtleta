import type { ThemeColors } from "./app-theme";
import type { UnitPalette } from "./unit-colors";
import { getUnitPalette } from "./unit-colors";

export type ClassColorKey = "blue" | "green" | "orange" | "red" | "teal" | "gray";

type ClassColorOption = {
  key: ClassColorKey | "default";
  label: string;
  palette: UnitPalette;
};

const COLOR_DEFS: Array<{
  key: ClassColorKey;
  label: string;
  palette: (colors: ThemeColors) => UnitPalette;
}> = [
  {
    key: "blue",
    label: "Azul",
    palette: (colors) => ({ bg: colors.primaryBg, text: colors.primaryText }),
  },
  {
    key: "green",
    label: "Verde",
    palette: (colors) => ({ bg: colors.successBg, text: colors.successText }),
  },
  {
    key: "orange",
    label: "Laranja",
    palette: (colors) => ({ bg: colors.warningBg, text: colors.warningText }),
  },
  {
    key: "red",
    label: "Vermelho",
    palette: (colors) => ({ bg: colors.dangerBg, text: colors.dangerText }),
  },
  {
    key: "teal",
    label: "Azul claro",
    palette: (colors) => ({ bg: colors.infoBg, text: colors.infoText }),
  },
  {
    key: "gray",
    label: "Neutro",
    palette: (colors) => ({ bg: colors.secondaryBg, text: colors.text }),
  },
];

export const getClassColorOptions = (
  colors: ThemeColors,
  fallbackUnit?: string
): ClassColorOption[] => {
  const fallbackPalette = fallbackUnit
    ? getUnitPalette(fallbackUnit, colors)
    : { bg: colors.secondaryBg, text: colors.text };
  return [
    { key: "default", label: "Padrão", palette: fallbackPalette },
    ...COLOR_DEFS.map((item) => ({
      key: item.key,
      label: item.label,
      palette: item.palette(colors),
    })),
  ];
};

export const getClassPalette = (
  colorKey: string | null | undefined,
  colors: ThemeColors,
  fallbackUnit?: string
): UnitPalette => {
  const match = COLOR_DEFS.find((item) => item.key === colorKey);
  if (match) return match.palette(colors);
  if (fallbackUnit) return getUnitPalette(fallbackUnit, colors);
  return { bg: colors.secondaryBg, text: colors.text };
};
