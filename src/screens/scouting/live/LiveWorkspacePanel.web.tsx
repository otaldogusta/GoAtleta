import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useWindowDimensions, type View } from 'react-native';
import { AnchoredDropdown } from '../../../ui/AnchoredDropdown';
import { overlayLayers } from '../../../ui/overlay-layers';
import { useResponsiveLayout } from '../../../ui/use-responsive-layout';
import { compactUiMetrics, radius, typography } from '../../../theme/tokens';
import { markRender, measureAsync } from '../../../observability/perf';
import { StudioAction, StudioDialog } from '../video/StudioUI.web';

type Anchor={x:number;y:number;width:number;height:number};
const emptyInteractiveRefs:RefObject<View|null>[]=[];
export default function LiveWorkspacePanel({open,title,kind,anchor,contentTarget,onClose,children,theme,interactiveRefs=emptyInteractiveRefs,onNestedDismiss}:{open:boolean;title:string;kind:'controls'|'library';anchor?:HTMLElement|null;contentTarget?:HTMLElement|null;onClose:()=>void;children:ReactNode;theme:CSSProperties;interactiveRefs?:RefObject<View|null>[];onNestedDismiss?:()=>void}){
    markRender('screen.scoutingLivePanel.render.web');
    const responsive=useResponsiveLayout(),{height}=useWindowDimensions(),id=useId(),content=useRef<HTMLDivElement|null>(null),restore=useRef(false),trigger=useRef<HTMLElement|null>(null),nestedEvent=useRef<Event|null>(null);
    const [position,setPosition]=useState<Anchor|null>(null),focused=useRef(false);
    const modal=kind==='library'||responsive.isMobile;
    const focusTrigger=useCallback(()=>{const element=trigger.current;if(element?.isConnected&&!element.closest('[hidden],[inert]'))element.focus();},[]);
    const dismiss=useCallback(()=>{onClose();if(restore.current)queueMicrotask(focusTrigger);restore.current=false;},[onClose,focusTrigger]);
    const nestedVisible=useCallback(()=>interactiveRefs.some(reference=>{
        const element=reference.current as unknown as HTMLElement|null;
        return !!element&&element.isConnected!==false&&!element.closest?.('[hidden],[inert]')&&(!element.getClientRects||element.getClientRects().length>0);
    }),[interactiveRefs]);
    const dismissAutomatically=useCallback(()=>{
        // The inner help owns the first dismissal, even if it unmounts before this listener runs.
        if(nestedEvent.current||nestedVisible()){restore.current=false;return;}
        dismiss();
    },[dismiss,nestedVisible]);
    useEffect(()=>{
        if(!open)return;trigger.current=anchor??(typeof document==='undefined'?null:document.activeElement as HTMLElement|null);
        const box=anchor?.getBoundingClientRect();
        const value=box?{x:box.x,y:box.y,width:box.width,height:box.height}:{x:Math.max(12,(typeof window==='undefined'?400:window.innerWidth)-396),y:72,width:360,height:0};
        let alive=true;
        void measureAsync('screen.scoutingLivePanel.load.position',()=>new Promise<void>(resolve=>{
            queueMicrotask(()=>{if(alive)setPosition(value);resolve();});
        }));
        const rememberInner=(event:Event)=>{
            if(!nestedVisible())return false;
            nestedEvent.current=event;queueMicrotask(()=>{if(nestedEvent.current===event)nestedEvent.current=null;});return true;
        };
        const key=(event:KeyboardEvent)=>{
            if(event.key!=='Escape')return;
            const nested=rememberInner(event);restore.current=!nested;
            // The primitive consumes Escape before invoking onRequestClose. Delegate it
            // here so only the inner layer closes and restores its own trigger focus.
            if(nested&&onNestedDismiss){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();onNestedDismiss();}
        };
        const pointer=(event:PointerEvent)=>{restore.current=false;rememberInner(event);};
        window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',pointer,true);
        return()=>{alive=false;nestedEvent.current=null;window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',pointer,true);};
    },[open,anchor,nestedVisible,onNestedDismiss]);
    useEffect(()=>{
        if(!open||contentTarget||modal){focused.current=false;return;}
        if(position&&!focused.current){focused.current=true;content.current?.focus();}
    },[open,contentTarget,modal,position]);
    if(!open||typeof document==='undefined')return null;
    const close=()=>{restore.current=true;dismiss();};
    const body=<div className="lwc-panel-body">{children}</div>;
    if(contentTarget)return createPortal(<div className="lwc-source-content" style={theme}><style>{workspacePanelStyles}</style>{body}</div>,contentTarget);
    const panel=modal?<StudioDialog title={title} className={`lwc-dialog ${kind==='controls'?'lwc-sheet':''}`} onClose={close}>{body}</StudioDialog>
        :<AnchoredDropdown visible layout={position} container={null} animationStyle={undefined} zIndex={overlayLayers.floatingList} maxHeight={Math.max(180,height-40)} nestedScrollEnabled density="popover" surface="solid" preferredWidth={360} fitContent align="end" portalToBodyOnWeb interactiveRefs={interactiveRefs} onRequestClose={dismissAutomatically} scrollContentStyle={{padding:0}}>
            <div ref={content} className="lwc-popover" style={theme} role="dialog" aria-modal="false" aria-labelledby={id} tabIndex={-1}><div className="lwc-panel-head"><h2 id={id}>{title}</h2><StudioAction label={`Fechar ${title.toLowerCase()}`} icon="close" onPress={close}/></div>{body}</div>
        </AnchoredDropdown>;
    return createPortal(<div className="sv lwc-portal" style={theme}><style>{workspacePanelStyles}</style>{panel}</div>,document.body);
}
export const workspacePanelStyles=`
.sv.lwc-portal{display:contents;position:static;inset:auto;width:auto;height:auto;font-family:${typography.body.fontFamily};font-size:${compactUiMetrics.bodyFontSize}px;color:var(--sv-text)}
.lwc-popover{font-family:${typography.body.fontFamily};font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px;color:var(--sv-text);box-sizing:border-box;outline:none;background:var(--sv-panel)}.lwc-popover *{box-sizing:border-box}.lwc-popover button{font-family:inherit}
.lwc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--sv-line)}.lwc-panel-head h2{font-size:${compactUiMetrics.bodyFontSize}px;margin:0;font-weight:600}.lwc-panel-body{display:flex;flex-direction:column;gap:12px;padding:12px}.lwc-panel-body p{margin:0}.lwc-panel-body .sv-live-pair{margin:0}.lwc-panel-body .lc-connection .sv-live-qr{max-width:164px}.lwc-panel-body .lc-connection{font-size:${compactUiMetrics.bodyFontSize}px}
.lwc-source-content>.lwc-panel-body{padding:0}
.sv-dialog.lwc-dialog{width:min(620px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:12px;box-sizing:border-box;border-radius:${radius.card}px;background:var(--sv-panel);color:var(--sv-text);font-family:${typography.body.fontFamily};overflow:auto}.lwc-dialog>.lwc-panel-body{padding:12px 0 0}.lwc-dialog>.sv-row h2{font-size:${compactUiMetrics.bodyFontSize}px}
@media(max-width:767px){.sv-dialog.lwc-sheet{position:fixed;inset:auto 0 0;margin:0;width:100%;max-width:100%;max-height:88dvh;border-radius:${radius.card}px ${radius.card}px 0 0;padding:12px 16px max(16px,env(safe-area-inset-bottom))}.sv-dialog.lwc-dialog:not(.lwc-sheet){width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}}
`;
