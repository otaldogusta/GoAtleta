import { useRef, useState } from 'react';
import { View } from 'react-native';
import { OperationalText as Text } from '../../ui/OperationalText';
import { AnchoredDropdown } from '../../ui/AnchoredDropdown';
import { AnchoredDropdownOption } from '../../ui/AnchoredDropdownOption';
import { GoAtletaIcon } from '../../ui/icon-registry';
import { useAppTheme } from '../../ui/app-theme';
import { StudioAction } from './video/StudioUI.web';
import { useOptionalCopilot } from '../../copilot/CopilotProvider';

export function ScoutingWorkspaceMenu({ canCreate, disabled, onCreate, onFinish, canFinish, onSources }: {
    canCreate: boolean; disabled: boolean; canFinish: boolean; onCreate: () => void; onFinish: () => void; onSources?: () => void;
}) {
    const { colors } = useAppTheme();
    const copilot = useOptionalCopilot();
    const trigger = useRef<View>(null);
    const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const close = () => { setAnchor(null); (trigger.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('[role="button"],button')?.focus(); };
    const open = () => { if (anchor) close(); else trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height })); };
    const itemStyle = { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 } as const;
    return <>
        <View ref={trigger} collapsable={false} nativeID={copilot?'scouting-chat-entry':undefined}><StudioAction label="Opções da análise" icon="ellipsisHorizontal" expanded={!!anchor} disabled={disabled} onPress={open}/></View>
        <AnchoredDropdown visible={!!anchor} layout={anchor} container={null} animationStyle={{}} zIndex={6200} nestedScrollEnabled fitContent density="menu" preferredWidth={230} maxHeight={240} interactiveRefs={[trigger]} onRequestClose={close}>
            {onSources?<AnchoredDropdownOption active={false} accessibilityLabel="Fonte do vídeo e gravações" density="compact" disabled={disabled} onPress={()=>{close();onSources();}}><View style={itemStyle}><GoAtletaIcon name="gallery" size={16} color={colors.text}/><Text style={{color:colors.text,fontSize:12}}>Fonte e gravações</Text></View></AnchoredDropdownOption>:null}
            {canCreate?<AnchoredDropdownOption active={false} accessibilityLabel="Nova análise no estúdio" density="compact" disabled={disabled} onPress={()=>{close();onCreate();}}><View style={itemStyle}><GoAtletaIcon name="add" size={16} color={colors.text}/><Text style={{color:colors.text,fontSize:12}}>Nova análise</Text></View></AnchoredDropdownOption>:null}
            {copilot?<AnchoredDropdownOption active={false} accessibilityLabel="Abrir chat do estúdio" density="compact" disabled={disabled} onPress={()=>{close();copilot.open();}}><View style={itemStyle}><GoAtletaIcon name="chat" size={16} color={colors.text}/><Text style={{color:colors.text,fontSize:12}}>Assistente</Text></View></AnchoredDropdownOption>:null}
            <AnchoredDropdownOption active={false} accessibilityLabel="Encerrar análise pelo menu" density="compact" disabled={!canFinish||disabled} onPress={()=>{close();onFinish();}}><View style={itemStyle}><GoAtletaIcon name="checkmark" size={16} color={colors.text}/><Text style={{color:colors.text,fontSize:12}}>Encerrar análise</Text></View></AnchoredDropdownOption>
        </AnchoredDropdown>
    </>;
}
