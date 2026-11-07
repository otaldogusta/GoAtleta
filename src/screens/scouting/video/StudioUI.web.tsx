import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Pressable } from '../../../ui/Pressable';

import { GoAtletaIcon, type GoAtletaIconName } from '../../../ui/icon-registry';

import { useAppTheme } from '../../../ui/app-theme';
import { compactUiMetrics } from '../../../theme/tokens';

export function StudioAction({ label, icon, iconContent, children, onPress, disabled, active, primary, describedBy, expanded, hasPopup }: {

    label: string;
    describedBy?: string;
    expanded?: boolean;
    hasPopup?: 'dialog';

    icon?: GoAtletaIconName;
    iconContent?: ReactNode;

    children?: ReactNode;

    onPress: () => void;

    disabled?: boolean;

    active?: boolean;

    primary?: boolean;

}) {

    const { colors } = useAppTheme();

    return <span className={`sv-action${children ? '' : ' sv-icon'}`} title={describedBy ? undefined : label}><Pressable aria-pressed={active} aria-expanded={expanded} aria-haspopup={hasPopup} aria-describedby={describedBy} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active, expanded }} disabled={disabled} onPress={onPress} style={{ width: '100%', minHeight: 38, minWidth: 38, paddingHorizontal: children ? 12 : 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: active ? colors.primaryBg : colors.border, backgroundColor: primary ? colors.primaryBg : active ? colors.successBg : 'transparent', opacity: disabled ? .45 : 1 }}>

    {iconContent ? <span aria-hidden="true" style={{ display: 'flex', color: primary ? colors.primaryText : active ? colors.successText : colors.text }}>{iconContent}</span> : icon ? <GoAtletaIcon name={icon} size={compactUiMetrics.iconSize} color={primary ? colors.primaryText : active ? colors.successText : colors.text}/> : null}

    {children ? <span style={{ color: primary ? colors.primaryText : active ? colors.successText : colors.text }}>{children}</span> : null}

  </Pressable></span>;

}

export function StudioDialog({ title, onClose, children, className = '', headerActions }: {

    title: string;

    className?: string;

    headerActions?: ReactNode;

    onClose: () => void;

    children: ReactNode;

}) {

    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => { const node = ref.current; node?.showModal(); return () => node?.close(); }, []);

    return <dialog className={`sv-dialog ${className}`} ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby={titleId}><div className="sv-row"><h2 id={titleId}>{title}</h2>{headerActions}<StudioAction label="Fechar" icon="close" onPress={onClose}/></div>{children}</dialog>;

}
