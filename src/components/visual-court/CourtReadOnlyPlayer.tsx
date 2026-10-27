import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { CourtVisualPayload } from '../../core/visual-court';
import { useAppTheme } from '../../ui/app-theme';
import { CourtActionButton } from './CourtEditorControls';
import { CourtPerspectiveCanvas } from './CourtPerspectiveCanvas';
import { CourtEditorCanvas, type CourtEditorCanvasProps } from './CourtEditorCanvas';
import { CourtSimulationTransport } from './CourtSimulationControls';

const noop = () => {};
/** No editor hook, roster, persistence, or mutation callbacks in the shared player. */
export function CourtReadOnlyPlayer({ payload, onClose }: { payload: CourtVisualPayload; onClose: () => void }) {
  const { colors } = useAppTheme();
  const [view, setView] = useState<'2d' | '3d'>('3d');
  const [stepIndex, setStepIndex] = useState(0), [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1);
  const [camera, setCamera] = useState<'front' | 'side' | 'orbit'>('front');
  const [showSteps, setShowSteps] = useState(false);
  const playhead = useRef(0);
  const step = payload.timeline.steps[stepIndex] ?? payload.timeline.steps[0];
  useEffect(() => {
    if (!playing) return;
    const duration = Math.max(450, step.durationMs / speed);
    const start = performance.now() - (playhead.current >= 1 ? 0 : playhead.current) * duration;
    let frame = 0;
    const tick = (now: number) => {
      const value = Math.min(1, (now - start) / duration);
      playhead.current = value; setProgress(value);
      if (value < 1) frame = requestAnimationFrame(tick); else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, step.durationMs, speed]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const pause = () => { if (document.visibilityState !== 'visible') setPlaying(false); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  const seek = (value: number) => { setPlaying(false); playhead.current = value; setProgress(value); };
  const chooseStep = (index: number) => { seek(0); setStepIndex(index); setShowSteps(false); };
  const canvas: CourtEditorCanvasProps = { payload, stepIndex, progress, landscape: true, half: false, plain: false,
    tool: 'pan', selected: [], disabled: true, grid: false, zoom: 1, pan: { x: 0, y: 0 }, color: colors.primaryBg, dashed: false,
    onSelect: noop, onMove: noop, onDraw: noop, onEditText: noop, onAddPlayer: noop, onPan: noop, onZoom: noop };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ padding: 12, gap: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', zIndex: 1 }}>
      <View style={{ flex: 1, minWidth: 140 }}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600' }}>{payload.editor?.title || 'Jogada'}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Somente leitura</Text></View>
      <CourtActionButton icon="view" text label={view === '3d' ? 'Quadra 2D' : 'Quadra 3D'} onPress={() => setView(view === '3d' ? '2d' : '3d')} />
      {view === '3d' ? <CourtActionButton icon="camera" text label="Câmera" onPress={() => setCamera(camera === 'front' ? 'side' : camera === 'side' ? 'orbit' : 'front')} /> : null}
      <CourtActionButton icon="close" text label="Fechar" onPress={onClose} />
    </View>
    <View style={{ flex: 1 }}>
      {view === '3d' ? <CourtPerspectiveCanvas {...canvas} active cameraView={camera} cameraReset={0} onShortcut={noop} onOpenProperties={noop} /> : <CourtEditorCanvas {...canvas} />}
      {showSteps ? <ScrollView accessibilityLabel="Etapas da jogada" style={{ position: 'absolute', right: 12, bottom: 80, maxHeight: '60%', maxWidth: '90%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12 }} contentContainerStyle={{ padding: 8, gap: 4 }}>
        {payload.timeline.steps.map((item, index) => <CourtActionButton key={item.id} text icon="courtMotion" label={`${index + 1} · ${item.label}`} active={index === stepIndex} onPress={() => chooseStep(index)} />)}
      </ScrollView> : null}
      <CourtSimulationTransport playing={playing} progress={progress} speed={speed} rotation={0} showRotation={false}
        onPlay={() => setPlaying(value => !value)} onRestart={() => seek(0)} onSeek={seek} onSpeed={setSpeed}
        onPreviousRotation={noop} onNextRotation={noop} onOpenSteps={() => setShowSteps(value => !value)} bottom={24} />
    </View>
    <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 4 }}><View style={{ gap: 6, flexDirection: 'row', alignItems: 'center' }}>
      <CourtActionButton icon="chevronBack" text label="Etapa anterior" disabled={stepIndex === 0} onPress={() => chooseStep(stepIndex - 1)} />
      <Text numberOfLines={1} style={{ flex: 1, color: colors.text, textAlign: 'center' }}>{stepIndex + 1}/{payload.timeline.steps.length} · {step.label}</Text>
      <CourtActionButton icon="chevronForward" text label="Próxima etapa" disabled={stepIndex === payload.timeline.steps.length - 1} onPress={() => chooseStep(stepIndex + 1)} />
    </View>{step.note ? <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{step.note}</Text> : null}</View>
  </View>;
}
