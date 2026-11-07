import { compactUiMetrics, radius } from '../../theme/tokens';

/** Integrated match desk: real collector and media owners share one responsive surface. */
export const scoutingBenchStyles=`
body:has(.sw-page:not([hidden]) #scouting-chat-entry) #copilot-launcher{display:none!important}
.sv.sw.sw-bench{gap:12px}
.sw-bench .sw-head{min-height:56px;gap:12px;border-bottom:1px solid var(--sv-line);padding-bottom:10px;flex-wrap:nowrap}
.sw-bench .sw-title{flex:1 1 190px;max-width:200px;min-width:120px}
.sw-bench .sw-title h1{font-size:20px;line-height:26px}.sw-bench .sw-title h1 small{display:none}
.sw-bench .sw-context{min-height:24px}.sw-bench .sw-context .sv-select [role=button]{min-height:24px!important;font-size:13px}.sw-bench .sw-context .sv-select [role=button]>span:last-child{font-size:${compactUiMetrics.metadataFontSize}px!important;line-height:${compactUiMetrics.metadataLineHeight}px}
.sw-bench .sw-task-nav{align-self:stretch;display:flex;align-items:center;flex:none;min-width:0}
.sw-bench .sw-task-nav [role=tab]>div{font-size:${compactUiMetrics.bodyFontSize}px!important;line-height:${compactUiMetrics.bodyLineHeight}px!important}
.sw-bench .sw-capture-chip [role=button]>span:last-child,.sw-bench .sw-finish [role=button]>span:last-child{font-size:${compactUiMetrics.bodyFontSize}px;line-height:${compactUiMetrics.bodyLineHeight}px}
.sw-bench .sw-statuses .sw-status-label{font-size:12px}
.sw-bench #scouting-bench-footer [role=button] [dir=auto]{font-size:${compactUiMetrics.bodyFontSize}px!important;line-height:${compactUiMetrics.bodyLineHeight}px!important}
.sw-bench .sw-head-actions{margin-left:auto;gap:6px;min-width:0}
.sw-bench .sw-capture-chip{flex:none;min-width:0}.sw-bench .sw-capture-chip [role=button]{border-radius:${radius.internal}px!important}
.sw-bench .sw-statuses{flex:none;padding-left:8px;margin-left:4px;border-left:1px solid var(--sv-line)}
.sw-bench .sw-finish{border:0;margin:0;padding:0}.sw-bench .sw-finish [role=button]{border:1px solid var(--sv-line)!important;border-radius:${radius.internal}px!important;padding-inline:10px!important}
.sw-bench .sw-body{flex:1;min-height:0;gap:16px;position:relative}
.sw-bench .sw-body[data-split=true]{display:grid!important;grid-template-columns:clamp(294px,26%,370px) minmax(0,1fr)!important;overflow:hidden!important;align-items:stretch}
.sw-bench .sw-body[data-split=true]>.sw-register{height:100%!important;overflow:hidden!important;min-height:0!important;width:100%;display:flex;flex-direction:column}
.sw-bench .sw-media{display:flex;flex-direction:column;min-height:0;min-width:0;position:relative;height:100%;overflow:hidden}
.sw-bench .sw-media>.sw-video{height:100%;min-height:0;min-width:0;flex:1;overflow:hidden}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-workspace{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(320px,1fr) max-content max-content;align-content:stretch;overflow:auto;height:100%;gap:10px}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-main{height:100%;min-height:0;overflow:hidden;flex:initial}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-stage{flex:1;aspect-ratio:auto;min-height:140px;max-height:none}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-player{flex:none}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]{height:200px;min-height:0;overflow:hidden;grid-template-rows:auto auto auto minmax(0,1fr);align-content:stretch}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-gallery-head{grid-row:1;grid-column:1}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-gallery-filters{grid-row:1;grid-column:2}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-section-meta{grid-row:2}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-row:not(.sv-gallery-head){grid-row:3}
.sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-grid{grid-row:4;height:100%;min-height:0;max-height:none;align-content:start;align-items:start;overflow-y:auto}
@container scouting-video-bench (max-width:620px){
 .sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-workspace{grid-template-rows:minmax(360px,1fr) max-content max-content}
 .sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]{height:248px;grid-template-rows:auto auto auto auto minmax(0,1fr)}
 .sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-gallery-head{grid-row:1;grid-column:1/-1}
 .sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-gallery-filters{grid-row:2;grid-column:1/-1}
 .sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-section-meta{grid-row:3}
 .sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-row:not(.sv-gallery-head){grid-row:4}
 .sw-bench .sw-body[data-split=true] .sv.sv-bench .sv-gallery[data-bench=true]>.sv-grid{grid-row:5}
}
.sw-bench .sw-media>.sw-capture[data-portaled=true]{display:block!important;position:absolute;inset:0;pointer-events:none;height:0!important;overflow:visible!important;padding:0}
.sw-bench .sw-media>.sw-capture[data-portaled=false]{display:block!important;min-width:0;min-height:0;flex:none;order:-1}
.sw-bench .sw-media>.sw-capture[data-portaled=false][data-available=false]{display:none!important}
.sw-bench .sw-media[data-preview=false] .lwc-bench{display:none!important}
.sw-bench .sw-media[data-live=true] .sv-player{opacity:.45;pointer-events:none}
.sw-bench .sw-media[data-live=true] .sv-bench-stage-context{visibility:hidden}
.sw-bench .sw-body[data-split=false]{display:flex!important;flex-direction:column;overflow:auto!important;gap:12px}
.sw-bench .sw-body[data-split=false]>.sw-register{flex:none!important;height:auto!important;min-height:0;overflow:visible!important}
.sw-bench .sw-body[data-split=false]>.sw-media{order:-1;flex:none;height:auto;overflow:visible;min-height:0}
.sw-bench .sw-body[data-split=false][data-mode=register]>.sw-media[data-preview=false]:has(.sw-video-existing:not([hidden]) .sv-bench-empty){display:none}
.sw-bench .sw-body[data-split=false] .sw-video,.sw-bench .sw-body[data-split=false] .sw-video-live,.sw-bench .sw-body[data-split=false] .sw-video-existing,.sw-bench .sw-body[data-split=false] .sv.sv-embedded{height:auto!important;flex:none;overflow:visible}
.sw-bench .sw-body[data-split=false] .sv-bench .sv-stage{flex:none;aspect-ratio:16/9;min-height:0;max-height:none}
.sw-bench .sw-body[data-split=false][data-mode=register] .sv-bench .sv-stage{max-height:190px;aspect-ratio:16/9;background:#050b12}
.sw-bench .sw-body[data-split=false][data-mode=register] .sv-bench .sv-player,.sw-bench .sw-body[data-split=false][data-mode=register] .sv-bench .sv-gallery,.sw-bench .sw-body[data-split=false][data-mode=register] .sv-bench-local-state{display:none}
.sw-bench .sw-body[data-split=false][data-mode=register] .sv-bench .sv-workspace{overflow:visible}
.sw-bench .sw-body[data-split=false][data-mode=video]>.sw-register[hidden]{display:none!important}
.sw-bench .sw-body[data-split=false] .sw-register>[role=region]{min-height:540px}
@container scouting-workspace (max-width:1120px){
 .sw-bench .sw-head{flex-wrap:wrap;gap:4px 8px}.sw-bench .sw-title{max-width:none;flex:1}.sw-bench .sw-task-nav{order:3;min-height:44px}.sw-bench .sw-head-actions{order:4;margin-left:auto;flex-basis:auto;padding:0}
 .sw-bench .sw-status-label{display:none}.sw-bench .sw-statuses{border:0;padding:0}.sw-bench .sw-finish-full{display:none}.sw-bench .sw-finish-short{display:inline}
}
@media(max-width:767px){
 .sv.sw.sw-bench{gap:8px}.sw-bench .sw-head{gap:4px;padding-bottom:6px;min-height:44px;flex-wrap:wrap}
 .sw-bench .sw-title{min-width:150px;flex:1 1 50%;max-width:calc(100% - 96px)}.sw-bench .sw-title h1{font-size:${compactUiMetrics.titleFontSize}px;line-height:${compactUiMetrics.titleLineHeight}px}
 .sw-bench .sw-task-nav{order:3;flex:none;min-height:44px}.sw-bench .sw-head-actions{order:4;flex:1 1 180px;gap:4px;justify-content:flex-start;max-width:100%;padding:0}
 .sw-bench .sw-capture-chip{flex:1;min-width:0}.sw-bench .sw-capture-chip [role=button]{padding-inline:8px!important;min-width:0!important}.sw-bench .sw-capture-chip [role=button]>span:last-child{min-width:0;font-size:11px}.sw-bench .sw-capture-chip [role=button]>span:last-child>span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .sw-bench .sw-head-actions>.sv-action [role=button]{padding:6px!important}.sw-bench .sw-statuses{display:none}
 .sw-bench .sw-body[data-split=false]>.sw-register{width:100%}
 .sw-bench .sw-body[data-split=false][data-mode=register]>.sw-media{order:1}
 .sw-bench .sw-body[data-split=false][data-mode=register] .sv-bench .sv-stage{max-height:144px}
}
@media(max-width:379px){.sw-bench .sw-finish{display:none}.sw-bench .sw-head-actions{gap:2px}}
`;
