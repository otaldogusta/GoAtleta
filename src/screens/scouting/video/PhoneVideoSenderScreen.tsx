import { Text, View } from 'react-native';
import { markRender } from '../../../observability/perf';
import { useAppTheme } from '../../../ui/app-theme';

// perf-check: ignore-measure -- Browser-only transfer, with an inert native fallback.
export default function PhoneVideoSenderScreen() {
    markRender('screen.scouting.phone-video.render.native');
    const { colors } = useAppTheme();
    return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
        <Text style={{ color: colors.text }}>Abra o QR no navegador do celular para enviar o MP4.</Text>
    </View>;
}
