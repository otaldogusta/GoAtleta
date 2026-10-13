// perf-check: ignore-measure -- Static native fallback; no data or media is loaded.
import { markRender } from '../../../observability/perf';
import { View } from 'react-native';
import { Button } from '../../../ui/Button';
import { ScoutingModal, Copy } from '../ScoutingUI';
import type { StudioProps } from './types';
// Expo resolves the web player separately; no DOM/video code enters native bundles.
export default function ScoutingVideoStudio({ onClose }: StudioProps) {
  markRender('screen.scouting.video.render.native');
    return <ScoutingModal title="Estúdio de vídeo" onClose={onClose}><View style={{ gap: 12 }}><Copy>O estúdio de vídeo está disponível na versão web do Go Atleta.</Copy><Button label="Voltar ao scouting" onPress={onClose}/></View></ScoutingModal>;
}
