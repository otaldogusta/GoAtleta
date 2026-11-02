import { View } from 'react-native';
import { Copy, Link } from '../ScoutingUI';
import { markRender } from '../../../observability/perf';
// perf-check: ignore-measure -- Static native fallback; it neither loads a recording nor creates a connection.
export default function ScoutingLive({onClose}:{userId:string;org:string;classId:string;className?:string;onClose:()=>void}) {
    markRender('screen.scoutingLive.render.native');
    return <View style={{padding:20,gap:12}}><Copy title>Scouting ao vivo</Copy><Copy>Abra o Go Atleta no navegador do notebook para conectar a câmera.</Copy><Link label="Voltar" onPress={onClose}/></View>;
}
