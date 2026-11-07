import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { View } from 'react-native';
import { markRender, measureAsync } from '../../../observability/perf';
import { compactUiMetrics, radius, typography } from '../../../theme/tokens';
import { AnchoredDropdown } from '../../../ui/AnchoredDropdown';
import { useAppTheme } from '../../../ui/app-theme';
import { GoAtletaIcon } from '../../../ui/icon-registry';
import { overlayLayers } from '../../../ui/overlay-layers';
import { Pressable } from '../../../ui/Pressable';
import { StudioAction } from '../video/StudioUI.web';

export type LiveCameraConnectionProps = {
    hasRoom: boolean;
    qr: string;
    localCameraUrl?: string;
    cameraReady: boolean;
    connected: boolean;
    capturePending: boolean;
    interrupted: boolean;
    checking: boolean;
    checkResult?: string | null;
    checkDisabled: boolean;
    onCheck: () => void;
    onCopy: () => Promise<boolean>;
    /** Keep an enclosing popover open while its nested help is focused. */
    onPopoverElement?: (element: HTMLElement | null, close?: () => void) => void;
    portalToBodyOnWeb?: boolean;
    /** Show pairing directly inside the enclosing camera dialog. */
    inline?: boolean;
};

type Anchor = { x: number; y: number; width: number; height: number };
type Label = { text: string; layout: Anchor; trigger: RefObject<View | null>; context: object };
type CopyState = 'copying' | 'success' | 'error';

export default function LiveCameraConnection(props: LiveCameraConnectionProps) {
    markRender('screen.scoutingLiveConnection.render.web');
    const { onPopoverElement } = props;
    const { colors } = useAppTheme();
    const id = useId(), helpId = `live-camera-help-${id}`, labelId = `${helpId}-label`;
    const helpTrigger = useRef<View | null>(null), copyTrigger = useRef<View | null>(null), testTrigger = useRef<View | null>(null), qrTrigger = useRef<View | null>(null);
    const details = useRef<HTMLDetailsElement | null>(null), labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const helpContent = useRef<HTMLDivElement | null>(null), restoreFocus = useRef(false), copyBusy = useRef<{ context: object } | null>(null);
    const [anchor, setAnchor] = useState<Anchor | null>(null), [labelState, setLabel] = useState<Label | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<{ context: object; state: CopyState } | null>(null);
    const [qrDisplay, setQrDisplay] = useState<{ context: object; open: boolean } | null>(null);
    const copyContext = useMemo(() => ({ hasRoom: props.hasRoom, qr: props.qr }), [props.hasRoom, props.qr]);
    const labelContext = useMemo(() => ({ connected: props.connected, interrupted: props.interrupted, hasRoom: props.hasRoom, qr: props.qr }), [props.connected, props.interrupted, props.hasRoom, props.qr]);
    const copyState = copyFeedback?.context === copyContext ? copyFeedback.state : 'idle';
    const label = labelState?.context === labelContext ? labelState : null;
    const showQr=!!props.qr&&(!props.connected&&!props.interrupted||qrDisplay?.context===labelContext&&qrDisplay.open);
    const canToggleQr=!!props.qr&&(props.connected||props.interrupted),qrId=`${helpId}-qr`;
    const helpRefs = useMemo(() => [helpTrigger], []);
    const theme = {
        '--lc-panel': colors.card, '--lc-input': colors.inputBg, '--lc-text': colors.text,
        '--lc-muted': colors.muted, '--lc-line': colors.border, '--lc-primary': colors.primaryBg,
        '--lc-danger': colors.dangerText, '--lc-warning': colors.warningText,
    } as CSSProperties;
    const iconStyle = { width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, borderRadius: radius.internal, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' } as const;
    const localUrl = props.localCameraUrl && /^https?:\/\//i.test(props.localCameraUrl) ? props.localCameraUrl : undefined;
    const canCopy = props.hasRoom && !!props.qr;

    useEffect(() => () => { copyBusy.current = null; }, []);
    useEffect(() => {
        if (!props.inline && props.hasRoom && props.qr && (!props.connected || props.interrupted) && details.current) details.current.open = true;
    }, [props.inline, props.hasRoom, props.qr, props.connected, props.interrupted]);

    const keepLabel = useCallback(() => { if (labelTimer.current) clearTimeout(labelTimer.current); labelTimer.current = null; }, []);
    const hideLabel = useCallback(() => { keepLabel(); setLabel(null); }, [keepLabel]);
    const scheduleHideLabel = () => { keepLabel(); labelTimer.current = setTimeout(() => { labelTimer.current = null; setLabel(null); }, 140); };
    useEffect(() => keepLabel, [keepLabel, labelContext]);
    const dismissHelp = useCallback(() => {
        setAnchor(null);
        hideLabel();
        if (restoreFocus.current) {
            if (!props.inline && props.connected && !props.interrupted) details.current?.querySelector('summary')?.focus();
            else (helpTrigger.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('[role="button"],button')?.focus();
        }
        restoreFocus.current = false;
    }, [props.inline, props.connected, props.interrupted, hideLabel]);
    const closeHelp = useCallback(() => { restoreFocus.current = true; dismissHelp(); }, [dismissHelp]);
    const bindHelpContent = useCallback((element: HTMLDivElement | null) => { helpContent.current = element; onPopoverElement?.(element, element ? closeHelp : undefined); }, [onPopoverElement, closeHelp]);
    useEffect(() => {
        if (!anchor) return;
        helpContent.current?.focus();
        // Observe Escape before the primitive's document capture listener.
        // Outside clicks and Tab dismiss without pulling focus backwards.
        const key = (event: KeyboardEvent) => { if (event.key === 'Escape') restoreFocus.current = true; };
        window.addEventListener('keydown', key, true);
        return () => window.removeEventListener('keydown', key, true);
    }, [anchor]);

    const showLabel = (trigger: RefObject<View | null>, text: string) => {
        if (anchor) return;
        keepLabel();
        trigger.current?.measureInWindow((x, y, width, height) => setLabel({ text, layout: { x, y, width, height }, trigger, context: labelContext }));
    };
    const toggleHelp = () => {
        hideLabel();
        if (anchor) { restoreFocus.current = true; dismissHelp(); return; }
        helpTrigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
    };
    const copy = async () => {
        if (!canCopy || copyBusy.current?.context === copyContext) return;
        const operation = { context: copyContext }; copyBusy.current = operation; setCopyFeedback({ context: copyContext, state: 'copying' });
        try {
            const copied = await measureAsync('screen.scoutingLiveConnection.load.copyLink', () => props.onCopy());
            if (copyBusy.current === operation) setCopyFeedback({ context: copyContext, state: copied ? 'success' : 'error' });
        } catch { if (copyBusy.current === operation) setCopyFeedback({ context: copyContext, state: 'error' }); }
        finally { if (copyBusy.current === operation) copyBusy.current = null; }
    };
    const copyLabel = copyState === 'copying' ? 'Copiando…' : copyState === 'success' ? 'Link copiado' : copyState === 'error' ? 'Não foi possível copiar. Tente novamente.' : '';
    const help = <View ref={helpTrigger} collapsable={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ajuda da conexão da câmera"
            aria-expanded={!!anchor} aria-controls={helpId} aria-haspopup="dialog"
            aria-describedby={label?.trigger === helpTrigger ? labelId : undefined}
            onPress={toggleHelp} onHoverIn={() => showLabel(helpTrigger, 'Ajuda da conexão')}
            onHoverOut={scheduleHideLabel} onFocus={() => showLabel(helpTrigger, 'Ajuda da conexão')} onBlur={scheduleHideLabel}
            style={iconStyle} disableWebPressScale>
            <GoAtletaIcon name="info" size={compactUiMetrics.iconSize} color={colors.text}/>
        </Pressable>
    </View>;
    const toggleQr=()=>{hideLabel();setQrDisplay({context:labelContext,open:!showQr});};
    const qrAction=canToggleQr?<View ref={qrTrigger} collapsable={false}>
        {props.interrupted&&!showQr?<StudioAction label="Mostrar QR code da câmera" icon="qrCode" onPress={toggleQr}>Mostrar QR</StudioAction>:<Pressable accessibilityRole="button" accessibilityLabel={showQr?'Ocultar QR code da câmera':'Mostrar QR code da câmera'}
            aria-expanded={showQr} aria-controls={qrId} aria-describedby={label?.trigger===qrTrigger?labelId:undefined}
            onPress={toggleQr} onHoverIn={()=>showLabel(qrTrigger,showQr?'Ocultar QR':'Mostrar QR')} onHoverOut={scheduleHideLabel}
            onFocus={()=>showLabel(qrTrigger,showQr?'Ocultar QR':'Mostrar QR')} onBlur={scheduleHideLabel} style={iconStyle} disableWebPressScale>
            <GoAtletaIcon name="qrCode" size={compactUiMetrics.iconSize} color={colors.text}/>
        </Pressable>}
    </View>:null;

    const pairing = props.hasRoom ? <>
                {showQr?<><img id={qrId} className="sv-live-qr lc-qr" src={props.qr} alt="QR code para conectar a câmera do celular"/><p className="lc-prompt">Leia o QR no celular.</p></>:!props.qr&&!props.connected&&!props.interrupted?<p className="lc-prompt">Configure o acesso seguro para usar o celular.</p>:null}
                <div className="lc-actions" aria-label="Ações da conexão da câmera">
                    {showQr?<View ref={copyTrigger} collapsable={false}>
                        <Pressable accessibilityRole="button" accessibilityLabel="Copiar link da câmera" disabled={!canCopy || copyState === 'copying'}
                            accessibilityState={{ disabled: !canCopy || copyState === 'copying', busy: copyState === 'copying' }}
                            aria-describedby={label?.trigger === copyTrigger ? labelId : undefined}
                            onPress={() => { void copy(); }} onHoverIn={() => showLabel(copyTrigger, 'Copiar link')}
                            onHoverOut={scheduleHideLabel} onFocus={() => showLabel(copyTrigger, 'Copiar link')} onBlur={scheduleHideLabel}
                            style={[iconStyle, { opacity: canCopy && copyState !== 'copying' ? 1 : .55 }]} disableWebPressScale>
                            <GoAtletaIcon name={copyState === 'success' ? 'checkmark' : copyState === 'error' ? 'warningCircle' : copyState === 'copying' ? 'refresh' : 'copy'} size={compactUiMetrics.iconSize} color={copyState === 'success' ? colors.primaryBg : copyState === 'error' ? colors.dangerText : colors.text}/>
                        </Pressable>
                    </View>:null}
                    {showQr&&(!props.connected||props.interrupted)?<View ref={testTrigger} collapsable={false}>
                        {localUrl ? <a className="lc-icon-link" href={localUrl} target="_blank" rel="noopener noreferrer" aria-label="Testar câmera neste computador"
                            aria-describedby={label?.trigger === testTrigger ? labelId : undefined}
                            onMouseEnter={() => showLabel(testTrigger, 'Testar câmera neste computador')} onMouseLeave={scheduleHideLabel}
                            onFocus={() => showLabel(testTrigger, 'Testar câmera neste computador')} onBlur={scheduleHideLabel}>
                            <GoAtletaIcon name="video" size={compactUiMetrics.iconSize} color={colors.text}/>
                        </a> : <Pressable accessibilityRole="button" accessibilityLabel="Testar câmera neste computador" disabled style={[iconStyle, { opacity: .55 }]}><GoAtletaIcon name="video" size={compactUiMetrics.iconSize} color={colors.text}/></Pressable>}
                    </View>:null}
                    {qrAction}
                    {help}
                </div>
                {copyLabel&&showQr ? <p className={`lc-copy-feedback ${copyState}`} role={copyState === 'error' ? 'alert' : 'status'} aria-live="polite">{copyLabel}</p> : null}
            </> : <>
                <div className="lc-actions lc-service"><StudioAction label="Verificar serviço ao vivo" disabled={props.checking || props.checkDisabled} onPress={() => { if (!props.checking && !props.checkDisabled) props.onCheck(); }}>{props.checking ? 'Verificando…' : props.checkResult ? 'Verificar novamente' : 'Verificar serviço'}</StudioAction>{help}</div>
                {!props.checking && props.checkResult ? <p className="lc-check-result" role="status">{props.checkResult}</p> : null}
            </>;
    return <section className="lc-connection" style={theme}>
        <style>{connectionStyles}</style>
        {props.capturePending && props.interrupted ? <p className="lc-warning" role="alert"><GoAtletaIcon name="warningCircle" size={compactUiMetrics.iconSize} color={colors.warningText}/><span>A gravação pode continuar no celular. Não recarregue.</span></p> : null}
        {props.inline ? <div className="sv-live-pair lc-panel">{pairing}</div> : <details ref={details} className="sv-live-pair lc-panel" open={!props.connected || props.interrupted || !!anchor}
            onToggle={event => { if (!event.currentTarget.open) { hideLabel(); dismissHelp(); } }}>
            <summary>Conexão da câmera</summary>{pairing}
        </details>}
        <AnchoredDropdown visible={!!anchor} layout={anchor} container={null} animationStyle={undefined}
            zIndex={overlayLayers.floatingList} maxHeight={360} nestedScrollEnabled density="popover" surface="solid"
            fitContent preferredWidth={300} align="end" portalToBodyOnWeb={props.portalToBodyOnWeb??true} interactiveRefs={helpRefs} onRequestClose={dismissHelp} scrollContentStyle={{ padding: 0 }}>
            <div id={helpId} ref={bindHelpContent} className="lc-help" style={theme} role="dialog" aria-modal="false" aria-labelledby={`${helpId}-title`} tabIndex={-1}>
                <div className="lc-help-head"><h3 id={`${helpId}-title`}>Conectar a câmera</h3><button className="lc-help-close" type="button" aria-label="Fechar ajuda da conexão" onClick={closeHelp}><GoAtletaIcon name="close" size={compactUiMetrics.iconSize} color={colors.muted}/></button></div>
                <ol><li>Use o mesmo Wi-Fi no celular e no computador.</li><li>Leia o QR e toque em Ligar câmera.</li><li>Se a conexão cair, toque em Reconectar no celular.</li></ol>
                <p>O pareamento continua entre gravações.</p>
                {props.cameraReady ? <div className="lc-certificate"><p>Android: instale o certificado local antes de abrir a câmera.</p><a href="http://127.0.0.1:8096/certificate.crt" download="go-atleta-live-ca.crt">Baixar certificado local</a></div> : null}
            </div>
        </AnchoredDropdown>
        <AnchoredDropdown visible={!!label && !anchor} layout={label?.layout ?? null} container={null} animationStyle={undefined}
            zIndex={overlayLayers.floatingList} maxHeight={96} nestedScrollEnabled={false} density="popover" surface="solid"
            fitContent preferredWidth={220} align="end" portalToBodyOnWeb={props.portalToBodyOnWeb??true} interactiveRefs={label ? [label.trigger] : []} onRequestClose={hideLabel} scrollContentStyle={{ padding: 0 }}>
            <div id={labelId} className="lc-tooltip" role="tooltip" style={theme} onMouseEnter={keepLabel} onMouseLeave={scheduleHideLabel} onFocus={keepLabel} onBlur={scheduleHideLabel}>{label?.text}</div>
        </AnchoredDropdown>
    </section>;
}

const connectionStyles = `
.lc-connection,.lc-help,.lc-tooltip{font-family:${typography.body.fontFamily};box-sizing:border-box}.lc-help *,.lc-tooltip *{box-sizing:border-box}.lc-help button{font:inherit}
.lc-connection{min-width:0;color:var(--lc-text)}.lc-connection .lc-panel>summary{cursor:pointer;font-size:${compactUiMetrics.bodyFontSize}px;font-weight:600;margin-bottom:12px}
.lc-connection .lc-qr{display:block;width:196px;max-width:100%;height:auto;margin:0 auto;background:#fff;padding:8px;border-radius:${radius.internal}px}
.lc-connection p.lc-prompt,.lc-connection p.lc-copy-feedback,.lc-connection p.lc-check-result{font-size:${compactUiMetrics.metadataFontSize}px;line-height:${compactUiMetrics.metadataLineHeight}px;color:var(--lc-muted);margin:8px 0 0;overflow-wrap:anywhere}
.lc-connection p.lc-prompt{text-align:center}.lc-connection p.lc-copy-feedback.success{color:var(--lc-primary)}.lc-connection p.lc-copy-feedback.error{color:var(--lc-danger)}
.lc-actions{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px}.lc-actions.lc-service{justify-content:space-between;gap:12px}
.lc-icon-link{display:flex;align-items:center;justify-content:center;width:${compactUiMetrics.touchTarget}px;height:${compactUiMetrics.touchTarget}px;border-radius:${radius.internal}px;color:var(--lc-text);text-decoration:none}.lc-icon-link:hover{background:var(--lc-input)}.lc-icon-link:focus-visible,.lc-help-close:focus-visible{outline:2px solid var(--lc-primary);outline-offset:2px}
.lc-connection p.lc-warning{display:flex;align-items:flex-start;gap:8px;font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px;margin:0 0 12px;padding:8px 0 8px 10px;border-left:2px solid var(--lc-warning);color:var(--lc-warning)}
.lc-help{padding:12px;color:var(--lc-text);font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px;outline:none}.lc-help-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.lc-help h3{font-size:${compactUiMetrics.bodyFontSize}px;font-weight:600;margin:0}.lc-help-close{display:flex;align-items:center;justify-content:center;width:${compactUiMetrics.touchTarget}px;height:${compactUiMetrics.touchTarget}px;flex:none;border:0;border-radius:${radius.internal}px;background:transparent;cursor:pointer}.lc-help-close:hover{background:var(--lc-input)}
.lc-help ol{display:grid;gap:8px;padding-left:20px;margin:4px 0 12px}.lc-help p{font-size:${compactUiMetrics.metadataFontSize}px;line-height:${compactUiMetrics.metadataLineHeight}px;color:var(--lc-muted);margin:0}.lc-certificate{border-top:1px solid var(--lc-line);padding-top:12px;margin-top:12px}.lc-certificate a{display:inline-flex;align-items:center;min-height:${compactUiMetrics.touchTarget}px;color:var(--lc-text);font-size:${compactUiMetrics.bodyFontSize}px;text-underline-offset:3px}.lc-certificate a:focus-visible{outline:2px solid var(--lc-primary);outline-offset:2px}
.lc-tooltip{padding:8px 10px;color:var(--lc-text);font-size:${compactUiMetrics.metadataFontSize}px;line-height:${compactUiMetrics.metadataLineHeight}px}
`;
