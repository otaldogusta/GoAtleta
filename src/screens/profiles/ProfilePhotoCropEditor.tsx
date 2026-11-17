import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, useWindowDimensions, View, type ViewStyle } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";
import type { ProfilePhotoCrop } from "../../utils/profile-photo";

type Point = { x: number; y: number };
const center = { x: 0, y: 0 };
const maxZoom = 3;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ProfilePhotoCropEditor({ uri, saving, onCancel, onSave }: {
  uri: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (crop: ProfilePhotoCrop) => void;
}) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const frame = Math.max(96, Math.min(224, width - 112, height - 330));
  const margin = 22;
  const workspace = frame + margin * 2;
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>();
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState(center);
  const frameRef = useRef<View>(null);
  const livePosition = useRef(center);
  const dragStart = useRef(center);
  const scale = dimensions ? frame * zoom / Math.min(dimensions.width, dimensions.height) : 1;
  const sourceWidth = dimensions ? dimensions.width * scale : frame;
  const sourceHeight = dimensions ? dimensions.height * scale : frame;
  const sideways = rotation % 180 !== 0;
  const imageWidth = sideways ? sourceHeight : sourceWidth;
  const imageHeight = sideways ? sourceWidth : sourceHeight;
  const limitX = Math.max(0, (imageWidth - frame) / 2);
  const limitY = Math.max(0, (imageHeight - frame) / 2);
  const x = clamp(position.x, -limitX, limitX);
  const y = clamp(position.y, -limitY, limitY);

  const move = useCallback((p: Point) => {
    const next = { x: clamp(p.x, -limitX, limitX), y: clamp(p.y, -limitY, limitY) };
    livePosition.current = next;
    setPosition(next);
  }, [limitX, limitY]);

  // PanResponder reads these refs in gesture callbacks, after render.
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !saving && Boolean(dimensions),
    onPanResponderGrant: () => {
      const p = livePosition.current;
      dragStart.current = { x: clamp(p.x, -limitX, limitX), y: clamp(p.y, -limitY, limitY) };
    },
    onPanResponderMove: (_, { dx, dy }) => move({ x: dragStart.current.x + dx, y: dragStart.current.y + dy }),
  }), [dimensions, limitX, limitY, move, saving]);

  useEffect(() => {
    if (Platform.OS !== "web" || saving) return;
    const frameNode = frameRef.current as unknown as HTMLElement | null;
    const moveByKey = (event: KeyboardEvent) => {
      const delta: Record<string, Point> = {
        ArrowLeft: { x: -8, y: 0 }, ArrowRight: { x: 8, y: 0 },
        ArrowUp: { x: 0, y: -8 }, ArrowDown: { x: 0, y: 8 },
      };
      const step = delta[event.key];
      if (!step) return;
      event.preventDefault();
      move({ x: x + step.x, y: y + step.y });
    };
    frameNode?.addEventListener("keydown", moveByKey);
    return () => frameNode?.removeEventListener("keydown", moveByKey);
  }, [move, saving, x, y]);

  const changeZoom = (next: number) => {
    const offset = { x: x * next / zoom, y: y * next / zoom };
    livePosition.current = offset;
    setPosition(offset);
    setZoom(next);
  };

  const save = () => {
    if (!dimensions || failed) return;
    const rotatedWidth = sideways ? dimensions.height : dimensions.width;
    const rotatedHeight = sideways ? dimensions.width : dimensions.height;
    const side = Math.min(Math.min(rotatedWidth, rotatedHeight), Math.max(1, Math.round(frame / scale)));
    onSave({
      originX: clamp(Math.round((limitX - x) / scale), 0, rotatedWidth - side),
      originY: clamp(Math.round((limitY - y) / scale), 0, rotatedHeight - side),
      width: side,
      height: side,
      rotation,
    });
  };

  const busy = saving || !dimensions || failed;
  const zoomPercent = Math.round(zoom * 100);
  const zoomProgress = (zoom - 1) / (maxZoom - 1) * 100;
  const frameImage = (inset: number) => ({
    position: "absolute" as const,
    width: sourceWidth,
    height: sourceHeight,
    left: inset + (frame - sourceWidth) / 2 + x,
    top: inset + (frame - sourceHeight) / 2 + y,
    transform: [{ rotate: `${rotation}deg` as const }],
  });
  return <View style={{ gap: 10, alignItems: "center" }}>
    <Text style={{ color: colors.muted, fontSize: 13 }}>
      Arraste a foto para ajustar o enquadramento.
    </Text>
    <View
      ref={frameRef}
      {...pan.panHandlers}
      tabIndex={saving ? -1 : 0}
      accessibilityLabel="Enquadramento da foto. Use as setas para mover."
      style={[
        { width: workspace, height: workspace, borderRadius: 14, overflow: "hidden", backgroundColor: colors.secondaryBg },
        Platform.OS === "web" && { touchAction: "none", cursor: saving ? "default" : "grab" } as unknown as ViewStyle,
      ]}
    >
      <View pointerEvents="none" style={{ position: "absolute", inset: 0, opacity: 0.4 }}>
        {dimensions ? <Image source={{ uri }} contentFit="fill" style={frameImage(margin)} /> : null}
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: margin, top: margin, width: frame, height: frame, borderRadius: frame / 2, overflow: "hidden", backgroundColor: colors.secondaryBg }}>
        <Image
          source={{ uri }}
          contentFit={dimensions ? "fill" : "cover"}
          onLoad={({ source }) => {
            if (source.width > 0 && source.height > 0) setDimensions({ width: source.width, height: source.height });
          }}
          onError={() => setFailed(true)}
          style={frameImage(0)}
        />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: margin, top: margin, width: frame, height: frame, borderRadius: frame / 2, borderWidth: 1, borderColor: colors.text }} />
    </View>
    {failed ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>Não foi possível abrir a imagem.</Text> : null}
    <View style={{ width: "100%", maxWidth: 300, gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>Zoom</Text>
        <Text style={{ color: colors.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>{zoomPercent}%</Text>
      </View>
      {Platform.OS === "web" ? <>
        <style>{`
          .profile-photo-zoom { appearance: none; -webkit-appearance: none; border: 0; padding: 0; }
          .profile-photo-zoom::-webkit-slider-runnable-track { background: transparent; }
          .profile-photo-zoom::-moz-range-track { background: transparent; }
          .profile-photo-zoom::-webkit-slider-thumb {
            appearance: none; -webkit-appearance: none;
            width: 16px; height: 16px; border: 0; border-radius: 50%; background: currentColor;
          }
          .profile-photo-zoom::-moz-range-thumb {
            width: 16px; height: 16px; border: 0; border-radius: 50%; background: currentColor;
          }
          @media (forced-colors: active) {
            .profile-photo-zoom { appearance: auto; }
          }
        `}</style>
        <input
          className="profile-photo-zoom"
          type="range"
          min={100}
          max={maxZoom * 100}
          step={5}
          value={zoomPercent}
          disabled={busy}
          aria-label="Zoom"
          aria-valuetext={`${zoomPercent}%`}
          onChange={(event) => changeZoom(Number(event.currentTarget.value) / 100)}
          style={{
            width: "100%", height: 36, display: "block", margin: 0,
            background: `linear-gradient(to right, ${colors.primaryBg} ${zoomProgress}%, ${colors.border} ${zoomProgress}%) center / 100% 4px no-repeat`,
            color: colors.primaryBg, cursor: busy ? "default" : "ew-resize", opacity: busy ? 0.55 : 1,
          }}
        />
      </> : (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          <Button label="− Zoom" variant="secondary" disabled={busy || zoom <= 1} onPress={() => changeZoom(zoom - 0.25)} />
          <Button label="+ Zoom" variant="secondary" disabled={busy || zoom >= maxZoom} onPress={() => changeZoom(zoom + 0.25)} />
        </View>
      )}
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
      <Button label="Girar" variant="ghost" disabled={busy} onPress={() => {
        move(center);
        setRotation((rotation + 90) % 360);
      }} />
      <Button label="Redefinir" variant="ghost" disabled={busy || (zoom === 1 && rotation === 0 && x === 0 && y === 0)} onPress={() => {
        move(center);
        setZoom(1);
        setRotation(0);
      }} />
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
      <Button label="Cancelar" variant="secondary" disabled={saving} onPress={onCancel} />
      <Button label="Salvar foto" loading={saving} loadingLabel="Salvando" disabled={busy} onPress={save} />
    </View>
  </View>;
}
