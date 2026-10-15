import { useEffect, useId, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { AnchoredDropdown } from '../../../ui/AnchoredDropdown';
import { Pressable } from '../../../ui/Pressable';
import { useAppTheme } from '../../../ui/app-theme';
import { GoAtletaIcon } from '../../../ui/icon-registry';

/** The same solid, anchored menu used by studio sharing. */
export function StudioSelect<T extends string>({ label, value, options, onChange, compact = false }: {
  label: string; value: T; options: readonly { value: T; label: string }[];
  onChange: (value: T) => void; compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null), menu = useRef<HTMLDivElement>(null), id = useId();
  const focusFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const close = () => {
    cancelAnimationFrame(focusFrame.current);
    setOpen(false);
    (trigger.current as unknown as HTMLElement | null)?.querySelector?.<HTMLElement>('[role="button"]')?.focus({ preventScroll: true });
  };
  const show = () => trigger.current?.measureInWindow((x, y, width, height) => {
    setLayout({ x, y, width, height }); setOpen(true);
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true }));
  });
  return <span className={`sv-select${compact ? ' sv-select-compact' : ''}`} onKeyDown={event => {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); show(); }
  }}>
    <View ref={trigger} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} aria-haspopup="true" aria-expanded={open} aria-controls={open ? id : undefined} accessibilityState={{ expanded: open }} disableWebPressScale onPress={() => open ? close() : show()}
        style={{ minHeight: compact ? 36 : 40, paddingHorizontal: compact ? 8 : 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: compact ? 'transparent' : colors.inputBg }}>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12, color: colors.text }}>{options.find(option => option.value === value)?.label}</Text>
        <GoAtletaIcon name="chevronDown" size={12} color={colors.muted}/>
      </Pressable>
    </View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={12500} maxHeight={Math.min(280, options.length * 40 + 14)} nestedScrollEnabled fitContent density="menu" surface="solid" preferredWidth={compact ? 120 : Math.max(200, layout?.width ?? 0)} align={compact ? 'end' : 'start'} interactiveRefs={[trigger]} activeItemId={`${id}-${options.findIndex(option => option.value === value)}`} onRequestClose={close}>
      <div id={id} ref={menu} data-studio-menu role="radiogroup" aria-label={label} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus({ preventScroll: true });
        items[next]?.scrollIntoView({ block: 'nearest' });
      }}>
        {options.map((option, index) => <Pressable key={option.value} nativeID={`${id}-${index}`} role="radio" aria-checked={option.value === value} accessibilityLabel={option.label} disableWebPressScale onPress={() => { if (value !== option.value) onChange(option.value); close(); }} style={{ minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 16 }}>{option.value === value ? <GoAtletaIcon name="checkmark" size={16} color={colors.primaryBg}/> : null}</View>
          <Text style={{ flex: 1, color: colors.text, fontSize: 12 }}>{option.label}</Text>
        </Pressable>)}
      </div>
    </AnchoredDropdown>
  </span>;
}
