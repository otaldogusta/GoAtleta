
type GlassOverlayProps = {
  intensity: number;
  variant: "card" | "soft";
};

export function GlassOverlay({ intensity, variant = "card" }: GlassOverlayProps) {
  // On mobile, just use backdrop effect via semi-transparent overlay
  // On web, use backdrop-filter blur in parent component
  return null;
}
