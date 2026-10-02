import { Circle, G, Path } from "react-native-svg";

/** Connected volleyball panels, shared by the court and its tool icon. */
export function CourtVolleyballGlyph({ ink }: { ink?: string }) {
  const seam = ink ?? "#fff8de";
  return <G fill="none" strokeLinecap="round" strokeLinejoin="round">
    <Circle r={10} fill={ink ? "none" : "#ffd34d"} stroke={seam} strokeWidth={ink ? 1.7 : 0.6} />
    {[0, 120, 240].map(rotation => <G key={rotation} transform={`rotate(${rotation})`}>
      {!ink ? <Path d="M-6 -8 A10 10 0 0 1 0 -10 Q4 -6 6.07 0.27 Q3.41 0.7 0 0 Q-2 -6 -6 -8Z" fill="#1268c4" /> : null}
      <Path d="M0 0 Q-2 -6 -6 -8 M0 -10 Q4 -6 6.07 0.27" stroke={seam} strokeWidth={ink ? 1.35 : 0.65} />
    </G>)}
  </G>;
}
