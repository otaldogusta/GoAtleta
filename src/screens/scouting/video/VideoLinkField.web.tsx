import { useEffect, useRef } from 'react';
import { ActivityIndicator } from 'react-native';
import { GoAtletaIcon } from '../../../ui/icon-registry';
import { useAppTheme } from '../../../ui/app-theme';
import { videoLinkKind } from './studio-editing';

export function VideoLinkField({ value, disabled, valid, error, onChange, onVerify }: {
    value: string; disabled: boolean; valid: boolean; error: boolean;
    onChange: (value: string) => void; onVerify: () => void;
}) {
    const { colors } = useAppTheme();
    const verify = useRef(onVerify);
    useEffect(() => { verify.current = onVerify; }, [onVerify]);
    useEffect(() => {
        if (!value.trim() || disabled || videoLinkKind(value) === 'drive') return;
        const timer = setTimeout(() => verify.current(), 500);
        return () => clearTimeout(timer);
    }, [value, disabled]);
    const checking = !!value.trim() && videoLinkKind(value) !== 'drive' && !valid && !error;
    return <label className="sv-field">Link do vídeo <span>
        <input aria-label="Link do vídeo" type="url" value={value} placeholder="YouTube ou Google Drive" disabled={disabled} onChange={event => onChange(event.target.value)}/>
        <span role="status" aria-live="polite" style={{ display: 'inline-flex', flexShrink: 0, marginLeft: 8 }}>
            {valid && !error ? <span aria-label="Vídeo verificado" title="Vídeo verificado"><GoAtletaIcon name="checkmarkCircle" size={18} color={colors.primaryBg}/></span> : checking ? <ActivityIndicator accessibilityLabel="Verificando vídeo" size="small" color={colors.muted}/> : null}
        </span>
    </span></label>;
}
