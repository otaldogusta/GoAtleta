import { View } from 'react-native';
import { Copy, Link } from '../ScoutingUI';
export default function ScoutingLive({onClose}:{userId:string;org:string;classId:string;className?:string;onClose:()=>void}) {
    return <View style={{padding:20,gap:12}}><Copy title>Scouting ao vivo</Copy><Copy>Abra o Go Atleta no navegador do notebook para conectar a câmera.</Copy><Link label="Voltar" onPress={onClose}/></View>;
}
