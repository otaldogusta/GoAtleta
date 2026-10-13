// perf-check: ignore-measure -- Static native fallback; no data or media is loaded.
import { markRender } from '../../../observability/perf';
import { Text, View } from 'react-native';
import { useAppTheme } from '../../../ui/app-theme';
export default function SharedVideoScreen() {
  markRender('screen.scouting.video.render.shared-native');
  const { colors } = useAppTheme();
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}><Text style={{ color: colors.text }}>Abra o link da análise no navegador para assistir no estúdio do Go Atleta.</Text></View>;
}
