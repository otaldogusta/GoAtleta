import { View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";

import { COURT_FLOOR } from "../../../components/visual-court/CourtEditorScene";
import {
  PERIODIZATION_GAME_LEVELS,
  type PeriodizationGameLevel,
} from "../../../core/periodization-policy";
import {
  formatCourtMetres,
  getCourtDimensionsLabel,
  getPeriodizationCourtGeometry,
  REFERENCE_COURT,
} from "./periodization-court-geometry";

// Diagram colours from the supplied Mini 2x2 reference; 1x1 extends that reference.
const FORMAT_COLORS: Record<PeriodizationGameLevel, string> = {
  "1x1": "#6155a6",
  "2x2": "#79509b",
  "3x3": "#7acde3",
  "4x4": "#4da863",
  "6x6": "#ac206c",
};

export function CourtFormatGlyph({ level, color }: { level: PeriodizationGameLevel; color: string }) {
  const court = getPeriodizationCourtGeometry(level);
  return (
    <View style={{ width: 52, height: 28 }}>
      <Svg width="100%" height="100%" viewBox={`-0.5 -0.5 ${court.length + 1} ${court.width + 1}`} preserveAspectRatio="xMidYMid meet">
        <Rect x={0} y={0} width={court.length} height={court.width} fill="none" stroke={color} strokeWidth={0.2} />
        <Line x1={court.depthPerSide} x2={court.depthPerSide} y1={-0.3} y2={court.width + 0.3} stroke={color} strokeWidth={0.2} />
        {level === "6x6" ? [6, 12].map((x) => (
          <Line key={x} x1={x} x2={x} y1={0} y2={court.width} stroke={color} strokeWidth={0.15} />
        )) : null}
      </Svg>
    </View>
  );
}

export function PeriodizationCourtLevelDiagram({
  level,
}: {
  level: PeriodizationGameLevel;
}) {
  const court = getPeriodizationCourtGeometry(level);
  const endX = court.x + court.length;
  const dimensions = getCourtDimensionsLabel(level);
  const sideDimensions = `${formatCourtMetres(court.depthPerSide)} × ${formatCourtMetres(court.width)} m por lado`;

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flex: 1, minHeight: 0, backgroundColor: COURT_FLOOR }}>
        <Svg
          width="100%"
          height="100%"
          viewBox="-1.1 -1 20.2 11.4"
          preserveAspectRatio="xMidYMid meet"
          accessibilityLabel={`Quadras sobrepostas. ${level}: ${dimensions} no total, ${sideDimensions}. Linhas dos 3 metros e marcadores da zona de saque fixos na quadra 6x6.`}
        >
          {[...PERIODIZATION_GAME_LEVELS].reverse().map((format) => {
            const area = getPeriodizationCourtGeometry(format.value);
            return (
              <Rect
                key={format.value}
                x={area.x}
                y={area.y}
                width={area.length}
                height={area.width}
                fill={FORMAT_COLORS[format.value]}
                fillOpacity={0.16}
                stroke="#fff"
                strokeOpacity={0.2}
                strokeWidth={0.045}
              />
            );
          })}

          <Rect x={court.x} y={court.y} width={court.length} height={court.width} fill={FORMAT_COLORS[level]} />
          {PERIODIZATION_GAME_LEVELS.filter((format) => format.value !== level).map((format) => {
            const area = getPeriodizationCourtGeometry(format.value);
            return <Rect key={`reference-${format.value}`} x={area.x} y={area.y} width={area.length} height={area.width} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={0.045} />;
          })}

          {REFERENCE_COURT.attackLinesX.map((x) => (
            <Line key={x} x1={x} x2={x} y1={0} y2={9} stroke="#fff" strokeWidth={0.045} strokeDasharray="0.15 0.12" />
          ))}
          <Rect
            x={court.x}
            y={court.y}
            width={court.length}
            height={court.width}
            fill="none"
            stroke="#fff"
            strokeWidth={level === "6x6" ? 0.045 : 0.12}
          />
          {[0, REFERENCE_COURT.length].map((endLineX) => (
            <G key={`service-${endLineX}`}>
              {[0, REFERENCE_COURT.width].map((sidelineY) => {
                const direction = endLineX === 0 ? -1 : 1;
                return (
                  <Line
                    key={`${endLineX}-${sidelineY}`}
                    x1={endLineX + direction * 0.16}
                    x2={endLineX + direction * 0.62}
                    y1={sidelineY}
                    y2={sidelineY}
                    stroke="#fff"
                    strokeWidth={0.045}
                    strokeLinecap="round"
                  />
                );
              })}
            </G>
          ))}

          <Line x1={9} x2={9} y1={-0.2} y2={9.2} stroke="#fff" strokeWidth={0.16} />
          <Line x1={9} x2={9} y1={-0.2} y2={9.2} stroke="#34455b" strokeWidth={0.07} />
          <SvgText x={-0.8} y={4.6} fill="#fff" fontSize={0.46} fontWeight="700" textAnchor="middle">9 m</SvgText>

          {/* Full reference court length, across both sides of the net. */}
          <Line x1={0} x2={REFERENCE_COURT.length} y1={-0.4} y2={-0.4} stroke="#fff" strokeWidth={0.04} />
          {[0, REFERENCE_COURT.length].map((tick) => (
            <Line key={tick} x1={tick} x2={tick} y1={-0.55} y2={-0.25} stroke="#fff" strokeWidth={0.04} />
          ))}
          <Rect x={8.25} y={-0.72} width={1.5} height={0.65} rx={0.16} fill={COURT_FLOOR} />
          <SvgText x={9} y={-0.24} fill="#fff" fontSize={0.42} fontWeight="700" textAnchor="middle">18 m</SvgText>

          {/* Selected dimensions use the same metre coordinates as the court. */}
          {[{ from: court.x, to: 9 }, { from: 9, to: endX }].map(({ from, to }) => (
            <G key={from}>
              <Line x1={from} x2={to} y1={9.45} y2={9.45} stroke="#fff" strokeWidth={0.045} />
              {[from, to].map((tick) => <Line key={tick} x1={tick} x2={tick} y1={9.2} y2={9.65} stroke="#fff" strokeWidth={0.045} />)}
              <SvgText x={(from + to) / 2} y={10.05} fill="#fff" fontSize={0.45} fontWeight="700" textAnchor="middle">{formatCourtMetres(court.depthPerSide)} m</SvgText>
            </G>
          ))}
          <Line x1={endX + 0.35} x2={endX + 0.35} y1={court.y} y2={9} stroke="#fff" strokeWidth={0.045} />
          {[court.y, 9].map((y) => <Line key={y} x1={endX + 0.2} x2={endX + 0.5} y1={y} y2={y} stroke="#fff" strokeWidth={0.045} />)}
          <SvgText x={endX + 0.62} y={court.y + court.width / 2} fill="#fff" fontSize={0.4} fontWeight="700" transform={`rotate(90 ${endX + 0.62} ${court.y + court.width / 2})`} textAnchor="middle">{formatCourtMetres(court.width)} m</SvgText>
        </Svg>
      </View>
    </View>
  );
}
