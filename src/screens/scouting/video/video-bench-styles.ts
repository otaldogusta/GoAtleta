import { compactUiMetrics } from '../../../theme/tokens';

/** Bench-only composition; video, source, draft and export lifetimes remain canonical. */
export const videoBenchStyles = `
.sv.sv-bench{container-type:inline-size;container-name:scouting-video-bench;min-width:0;overflow:hidden;font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px}
.sv.sv-bench .sv-action{font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px}
.sv.sv-bench .sv-workspace,.sv.sv-bench .sv-workspace:has(.sv-inspector.closed){display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain}
.sv.sv-bench .sv-gallery[data-bench=true]{overflow-anchor:none}
.sv.sv-bench .sv-main{flex:none;display:flex;overflow:visible;min-width:0;min-height:0;gap:0;border:1px solid var(--sv-line);border-radius:12px;background:var(--sv-panel)}
.sv.sv-bench .sv-stage{flex:none;aspect-ratio:16/9;min-height:0;width:100%;max-height:max(220px,calc(100dvh - 450px));border-radius:11px 11px 0 0}
.sv.sv-bench .sv-stage:has(.sv-bench-empty){background:var(--sv-panel)}
.sw-bench .sw-body[data-split=false][data-mode=register] .sv.sv-bench .sv-stage:has(.sv-bench-empty){background:var(--sv-panel)}
.sv.sv-bench .sv-bench-empty{justify-items:center;gap:12px;max-width:280px;padding:24px;color:var(--sv-text)}
.sv.sv-bench .sv-bench-empty-icon{display:flex;color:var(--sv-muted)}
.sv.sv-bench .sv-bench-empty h2{margin:0;font-size:${compactUiMetrics.titleFontSize}px;line-height:${compactUiMetrics.titleLineHeight}px;font-weight:600}
.sv.sv-bench .sv-bench-empty>.sv-action{width:auto;justify-self:center}
.sv.sv-bench .sv-bench-empty>.sv-action :is(button,[role=button]){min-height:${compactUiMetrics.touchTarget}px!important}
.sv.sv-bench .sv-player{padding:4px 12px 0;background:var(--sv-panel);border-radius:0 0 12px 12px}
.sv.sv-bench .sv-transport{gap:0;flex-wrap:wrap;margin:0;min-height:44px}
.sv.sv-bench .sv-transport time{font-size:${compactUiMetrics.metadataFontSize}px;line-height:${compactUiMetrics.metadataLineHeight}px;white-space:nowrap;margin:0 4px}
.sv.sv-bench .sv-transport .sv-select :is(button,[role=button])>:first-child{font-size:${compactUiMetrics.bodyFontSize}px!important;line-height:${compactUiMetrics.bodyLineHeight}px!important}
.sv.sv-bench .sv-transport .sv-action :is(button,[role=button]){min-width:44px!important;min-height:44px!important;border:0!important}
.sv.sv-bench .sv-transport .sv-action:nth-child(2),.sv.sv-bench .sv-transport .sv-action:nth-child(4){display:none}
.sv.sv-bench .sv-reviewbar :is(.sv-transport,.sv-playback-tools) .sv-action :is(button,[role=button]){position:relative;background:transparent!important;box-shadow:none!important}
.sv.sv-bench .sv-reviewbar :is(.sv-transport,.sv-playback-tools) .sv-action :is(button,[role=button]) [aria-hidden=true]{font-size:${compactUiMetrics.iconSize}px!important;width:${compactUiMetrics.iconSize}px!important;height:${compactUiMetrics.iconSize}px!important}
.sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(3) :is(button,[role=button])::after{content:'';position:absolute;inset:${(compactUiMetrics.touchTarget-compactUiMetrics.controlHeight)/2}px;border-radius:8px;background:var(--sv-green);pointer-events:none;z-index:0}
.sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(3) :is(button,[role=button])>[aria-hidden=true]{position:relative;z-index:1}
.sv.sv-bench .sv-reviewbar{display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;column-gap:8px;align-items:start;min-width:0}
.sv.sv-bench .sv-reviewbar>.sv-transport{grid-column:1;grid-row:1;flex-wrap:nowrap}
.sv.sv-bench .sv-reviewbar>.sv-timeline{grid-column:2;grid-row:1;min-width:0;width:100%}
.sv.sv-bench .sv-reviewbar .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek{height:64px}
.sv.sv-bench .sv-reviewbar>.sv-playback-tools{grid-column:3;grid-row:1;display:flex;align-items:center;justify-content:flex-end;gap:0;min-height:44px;min-width:0}
.sv.sv-bench .sv-playback-tools .sv-action :is(button,[role=button]),.sv.sv-bench .sv-playback-tools .sv-select :is(button,[role=button]){min-width:44px!important;min-height:44px!important;border:0!important}
.sv.sv-bench .sv-playback-tools .sv-select :is(button,[role=button])>:first-child{font-size:${compactUiMetrics.bodyFontSize}px!important;line-height:${compactUiMetrics.bodyLineHeight}px!important}
@container scouting-video-bench (max-width:720px){
 .sv.sv-bench .sv-reviewbar{grid-template-columns:max-content minmax(0,1fr);grid-template-rows:64px minmax(44px,max-content);column-gap:8px}
 .sv.sv-bench .sv-reviewbar>.sv-transport{grid-column:1;grid-row:1/3;display:grid;grid-template-columns:44px max-content;grid-template-rows:44px 44px;gap:20px 4px;min-width:0;align-items:center}
 .sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action{width:44px;justify-self:start}
 .sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(1){grid-column:1;grid-row:2}
 .sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(3){grid-column:1;grid-row:1}
 .sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(5){grid-column:2;grid-row:2}
 .sv.sv-bench .sv-reviewbar>.sv-transport>time{grid-column:2;grid-row:1;margin:0;font-size:12px}
 .sv.sv-bench .sv-reviewbar>.sv-playback-tools{grid-column:2;grid-row:2;flex-wrap:wrap;align-self:start}
}
.sv-bench-stage-target{position:absolute;inset:0;z-index:5;pointer-events:none}
.sv-bench-stage-target:empty{display:none}
.sv-bench-stage-context{position:absolute;z-index:3;inset:12px 12px auto;display:flex;align-items:start;justify-content:space-between;gap:8px;pointer-events:none}
.sv-bench-stage-context>span{display:inline-flex;align-items:center;min-height:32px;padding:6px 10px;border:1px solid var(--sv-line);border-radius:8px;background:var(--sv-panel);color:var(--sv-text);font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px;font-weight:600;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-bench-stage-context>.sv-action{pointer-events:auto;background:var(--sv-panel);border-radius:8px}
.sv-bench-stage-context .sv-action :is(button,[role=button]){min-height:44px!important}
.sv.sv-bench .sv-bench-contact-strip{display:flex;align-items:center;gap:4px;overflow-x:auto;max-width:100%;padding:0 0 8px;margin:0;list-style:none;scrollbar-width:thin}
.sv-bench-contact-strip>li{display:flex;align-items:center;flex:none;min-width:0}
.sv-bench-contact-strip .sv-action :is(button,[role=button]){min-height:44px!important;max-width:210px;border:0!important;padding:4px 8px!important;background:transparent!important}
.sv-bench-contact-strip .sv-action :is(button,[role=button])>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:20px}
.sv-bench-contact-strip .sv-action :is(button,[role=button]):hover,.sv-bench-contact-strip .sv-action :is(button,[role=button]):focus-visible{background:var(--sv-input)!important}
.sv-bench-contact-arrow{color:var(--sv-muted);display:inline-flex;align-items:center}
.sv.sv-bench .sv-bench-tools{width:min(680px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:16px}
.sv.sv-bench .sv-bench-tools .sv-inspector{display:flex;min-height:0;border:0;background:transparent;overflow:visible}
.sv.sv-bench .sv-bench-tools .sv-panel{max-height:calc(100dvh - 210px);overflow:auto;padding:8px 0}
.sv.sv-bench .sv-bench-tools .sv-tabs{padding:0}
.sv.sv-bench .sv-bench-tools :is(h2,.sv-panel h2){font-size:16px;line-height:20px;font-weight:600}
.sv.sv-bench .sv-bench-tools .sv-panel h3{font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px;font-weight:600}
.sv.sv-bench .sv-bench-tools .sv-tabs>.sv-action{font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px}
.sv.sv-bench .sv-bench-tools :is(.sv-section-meta,.sv-footer small){font-size:12px;line-height:18px}
.sv.sv-bench .sv-bench-tools .sv-footer{padding:8px 0}
.sv.sv-bench .sv-bench-tools .sv-embedded-toolbar{position:relative;inset:auto;flex-wrap:wrap;display:flex}
.sv.sv-bench .sv-bench-local-state{display:flex;align-items:center;gap:6px;color:var(--sv-muted);font-size:12px;line-height:18px;padding:0 4px}
.sv.sv-bench .sv-timeline[data-soft-timeline] .sv-seek{height:44px;margin-top:0}
.sv.sv-bench .sv-timeline[data-soft-timeline] .sv-contact-markers{top:0;height:44px}
.sv.sv-bench .sv-timeline[data-soft-timeline] .sv-marker{opacity:.8}
.sv.sv-bench .sv-timeline[data-bench=true] :is(.sv-marker,.sv-point-marker){top:0}
.sv.sv-bench .sv-timeline[data-bench=true] :is(.sv-marker,.sv-point-marker) .sv-action :is(button,[role=button]){min-width:14px!important;width:14px!important;min-height:44px!important;height:44px!important;padding:0!important;border:0!important;border-radius:6px!important;background:transparent!important;box-shadow:none!important;overflow:visible}
.sv.sv-bench .sv-timeline[data-bench=true] :is(.sv-marker,.sv-point-marker) .sv-action :is(button,[role=button]):focus-visible{outline:2px solid var(--sv-green);outline-offset:2px}
.sv.sv-bench .sv-timeline[data-soft-timeline] .sv-timeline-caption{margin-bottom:0;font-size:13px;line-height:20px}
.sv.sv-bench .sv-timeline[data-soft-timeline] .sv-timeline-caption>span{font-size:13px;line-height:20px}
.sv.sv-bench .sv-timeline[data-soft-timeline] .sv-timeline-caption>small{font-size:12px;line-height:18px}
@container scouting-video-bench (max-width:560px){
 .sv.sv-bench .sv-player{padding:4px 6px 0}.sv.sv-bench .sv-transport{gap:0}.sv.sv-bench .sv-transport time{font-size:13px;margin:0 2px}.sv.sv-bench .sv-transport>.sv-spacer{display:none}
 .sv-bench-stage-context{inset:8px 8px auto}.sv-bench-stage-context>span{font-size:12px;line-height:18px;padding:4px 6px;min-height:32px}.sv-bench-stage-context .sv-action :is(button,[role=button]){padding-inline:8px!important}
}
@container scouting-video-bench (max-width:420px){
 .sv.sv-bench .sv-reviewbar{grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:64px 44px;column-gap:0}
 .sv.sv-bench .sv-reviewbar>.sv-transport,.sv.sv-bench .sv-reviewbar>.sv-playback-tools{display:contents}
 .sv.sv-bench .sv-reviewbar>.sv-timeline{grid-column:4/-1;grid-row:1}
 .sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(1){grid-column:1;grid-row:2}
 .sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(3){grid-column:1;grid-row:1}
 .sv.sv-bench .sv-reviewbar>.sv-transport>.sv-action:nth-child(5){grid-column:2;grid-row:2}
 .sv.sv-bench .sv-reviewbar>.sv-transport>time{grid-column:2/4;grid-row:1;align-self:start;justify-self:center;margin:14px 0 0;font-size:${compactUiMetrics.metadataFontSize}px;line-height:${compactUiMetrics.metadataLineHeight}px}
 .sv.sv-bench .sv-reviewbar>.sv-playback-tools>.sv-select{grid-column:3/5;grid-row:2;justify-self:center}
 .sv.sv-bench .sv-reviewbar>.sv-playback-tools>.sv-action:nth-child(2){grid-column:5;grid-row:2;justify-self:center;width:44px}
 .sv.sv-bench .sv-reviewbar>.sv-playback-tools>.sv-action:nth-child(3){grid-column:6;grid-row:2;justify-self:center;width:44px}
}
`;
