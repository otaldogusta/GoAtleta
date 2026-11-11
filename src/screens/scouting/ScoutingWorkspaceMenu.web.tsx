import { useRef, useState } from 'react';
import { View } from 'react-native';
import { OperationalText as Text } from '../../ui/OperationalText';
import { AnchoredDropdown } from '../../ui/AnchoredDropdown';
import { AnchoredDropdownOption } from '../../ui/AnchoredDropdownOption';
import { GoAtletaIcon } from '../../ui/icon-registry';
import { useAppTheme } from '../../ui/app-theme';
import { StudioAction } from './video/StudioUI.web';
import { useOptionalCopilot } from '../../copilot/CopilotProvider';
import type { StudioMenuAction } from './video/types';

export function ScoutingWorkspaceMenu({ canCreate, disabled, onCreate, onFinish, canFinish, onSources, videoActions, onVideoAction }: {
    canCreate: boolean; disabled: boolean; canFinish: boolean; onCreate: () => void; onFinish: () => void; onSources?: () => void;
    videoActions?: StudioMenuAction[] | null;
    onVideoAction?: (action: () => void) => void;
}) {
    const { colors } = useAppTheme();
    const copilot = useOptionalCopilot();
    const trigger = useRef<View>(null);
    const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const close = () => { setAnchor(null); (trigger.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('[role="button"],button')?.focus(); };
    const open = () => { if (anchor) close(); else trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height })); };
    const itemStyle = { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 } as const;
    const groups = (['Vídeo', 'Rallies', 'Análise'] as const).map(group => {
        const items: (StudioMenuAction & { text?: string; video?: boolean })[] = (videoActions ?? []).filter(item => item.group === group).map(item => ({ ...item, video: true }));
        if (group === 'Vídeo' && onSources) items.unshift({ id: 'sources', group, label: 'Fonte do vídeo e gravações', text: 'Fonte e gravações', icon: 'gallery', onPress: onSources });
        if (group === 'Análise') {
            if (canCreate) items.push({ id: 'create', group, label: 'Nova análise no estúdio', text: 'Nova análise', icon: 'add', onPress: onCreate });
            if (copilot) items.push({ id: 'assistant', group, label: 'Abrir chat do estúdio', text: 'Assistente', icon: 'chat', onPress: () => copilot.open() });
            items.push({ id: 'finish', group, label: 'Encerrar análise pelo menu', text: 'Encerrar análise', icon: 'checkmark', disabled: !canFinish, onPress: onFinish });
        }
        return { group, items };
    }).filter(({ items }) => items.length);
    return <>
        <View ref={trigger} collapsable={false} nativeID={copilot?'scouting-chat-entry':undefined}><StudioAction label="Opções do Estúdio" icon="options" expanded={!!anchor} disabled={disabled} onPress={open}>Opções</StudioAction></View>
        <AnchoredDropdown visible={!!anchor} layout={anchor} container={null} animationStyle={{}} zIndex={6200} nestedScrollEnabled fitContent density="popover" preferredWidth={250} maxHeight={440} interactiveRefs={[trigger]} onRequestClose={close}>
            {groups.map(({ group, items }, index) => <View key={group} style={{ borderTopWidth: index ? 1 : 0, borderTopColor: colors.border, paddingTop: index ? 6 : 0, marginTop: index ? 6 : 0 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 4 }}>{group}</Text>
                {items.map(item => <AnchoredDropdownOption key={item.id} active={false} accessibilityLabel={item.label} density="compact" style={{ borderWidth: 0, backgroundColor: 'transparent' }} disabled={disabled || item.disabled} onPress={() => {
                    if (disabled || item.disabled) return;
                    close();
                    if (item.video && onVideoAction) onVideoAction(item.onPress); else item.onPress();
                }}><View style={itemStyle}><GoAtletaIcon name={item.icon} size={16} color={colors.text}/><Text style={{ color: colors.text, fontSize: 12 }}>{item.text ?? item.label}</Text></View></AnchoredDropdownOption>)}
            </View>)}
        </AnchoredDropdown>
    </>;
}
