import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { AnchoredDropdown } from '../../../ui/AnchoredDropdown';
import { Pressable } from '../../../ui/Pressable';
import { useAppTheme } from '../../../ui/app-theme';
import { GoAtletaIcon } from '../../../ui/icon-registry';
import type { VideoShareAudience } from '../../../core/scouting-video-sharing';

const roles = [
  { id: 'viewer', label: 'Leitor', available: true },
  { id: 'commenter', label: 'Comentador', available: false },
  { id: 'editor', label: 'Editor', available: false },
] as const;

const audiences = [
  { id: 'team', label: 'Equipe desta turma', available: true },
  { id: 'link', label: 'Qualquer pessoa com o link', available: true },
] as const;

function ShareMenu<T extends string>({ value, options, label, heading, disabled = false, audience = false, onChange }: {
  value: T; options: readonly { id: T; label: string; available: boolean }[];
  label: string; heading?: string; disabled?: boolean; audience?: boolean; onChange?: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const close = () => {
    setOpen(false);
    (trigger.current as unknown as HTMLElement | null)?.querySelector?.<HTMLElement>('[role="button"]')?.focus();
  };
  return <span className={`sv-share-select${audience ? ' sv-share-select-audience' : ''}`}>
    <View ref={trigger} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} aria-haspopup="true" accessibilityState={{ expanded: open, disabled }} disabled={disabled} disableWebPressScale
        onPress={() => {
          if (open) { close(); return; }
          trigger.current?.measureInWindow((x, y, width, height) => { setLayout({ x, y, width, height }); setOpen(true); });
        }}
        style={{ minHeight: 44, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: audience ? colors.inputBg : colors.card, opacity: disabled ? .55 : 1 }}>
        <span className="sv-share-select-label">{options.find(option => option.id === value)?.label}</span>
        <GoAtletaIcon name="chevronDown" size={13} color={colors.text}/>
      </Pressable>
    </View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={12500} maxHeight={220} nestedScrollEnabled fitContent density="menu" surface="solid" preferredWidth={audience ? 290 : 260} align={audience ? 'start' : 'end'} portalToBodyOnWeb={false} interactiveRefs={[trigger]} onRequestClose={close}>
      <div role="radiogroup" aria-label={label} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'));
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}>
        {heading ? <Text style={{ fontSize: 10, fontWeight: '600', color: colors.muted, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 }}>{heading}</Text> : null}
        {options.map(option => <Pressable key={option.id} role="radio" aria-checked={option.id === value} accessibilityLabel={option.available ? option.label : `${option.label} — indisponível`} accessibilityState={{ disabled: !option.available }} disabled={!option.available} disableWebPressScale onPress={option.available ? () => { if (option.id !== value) onChange?.(option.id); close(); } : undefined}
          style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: option.available ? 1 : .55 }}>
          <View style={{ width: 18 }}>{option.id === value ? <GoAtletaIcon name="checkmark" size={18} color={colors.primaryBg}/> : null}</View>
          <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{option.label}</Text>
          {!option.available ? <Text style={{ color: colors.muted, fontSize: 10 }}>Indisponível</Text> : null}
        </Pressable>)}
      </div>
    </AnchoredDropdown>
  </span>;
}

export function VideoShareRoleMenu({ disabled = false }: { disabled?: boolean }) {
  return <ShareMenu value="viewer" options={roles} label="Permissão: Leitor" heading="FUNÇÃO" disabled={disabled}/>;
}

export function VideoShareAudienceMenu({ value, disabled, onChange }: { value: VideoShareAudience; disabled?: boolean; onChange: (value: VideoShareAudience) => void }) {
  return <ShareMenu value={value} options={audiences} label="Quem pode acessar" disabled={disabled} onChange={onChange} audience/>;
}
