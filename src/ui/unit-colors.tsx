import type { ThemeColors } from "./app-theme";

export type UnitPalette = {
  bg: string;
  text: string;
};

export const toRgba = (hex: string, alpha: number) => {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const getUnitPalette = (unit: string, colors: ThemeColors): UnitPalette => {
  const key = unit.toLowerCase();
  if (key.includes("esperanca")) {
    return { bg: colors.successBg, text: colors.successText };
  }
  if (key.includes("pinhais") || key.includes("esportes")) {
    return { bg: colors.warningBg, text: colors.warningText };
  }
  return { bg: colors.infoBg, text: colors.infoText };
};
