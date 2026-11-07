/** Presentation scoped to the canonical gallery/timeline; editor and media contracts stay unchanged. */
export const videoTimelineStyles = `
.sv .sv-timeline[data-soft-timeline] .sv-seek{height:64px;margin:4px 0 0}
.sv .sv-timeline[data-soft-timeline] .sv-seek input{height:44px;border:0!important;padding:0!important;border-radius:0;background:transparent!important;box-shadow:none!important;appearance:none;-webkit-appearance:none;outline:0}
.sv .sv-timeline[data-soft-timeline] .sv-seek input::-webkit-slider-runnable-track{height:5px;border:0;background:transparent;border-radius:5px}
.sv .sv-timeline[data-soft-timeline] .sv-seek input::-moz-range-track{height:5px;border:0;background:transparent;border-radius:5px}
.sv .sv-timeline[data-soft-timeline] .sv-seek input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:44px;height:44px;margin-top:-19.5px;border:0;border-radius:0;background:linear-gradient(var(--sv-text),var(--sv-text)) center/6px 12px no-repeat;opacity:1;cursor:ew-resize;box-shadow:none}
.sv .sv-timeline[data-soft-timeline] .sv-seek input::-moz-range-thumb{width:44px;height:44px;border:0;border-radius:0;background:linear-gradient(var(--sv-text),var(--sv-text)) center/6px 12px no-repeat;opacity:1;cursor:ew-resize;box-shadow:none}
.sv .sv-timeline[data-soft-timeline] .sv-seek input:focus-visible::-webkit-slider-thumb,.sv .sv-timeline[data-soft-timeline] .sv-seek input:hover::-webkit-slider-thumb{background:linear-gradient(var(--sv-text),var(--sv-text)) center/6px 12px no-repeat,radial-gradient(circle,color-mix(in srgb,var(--sv-text) 18%,transparent) 60%,transparent 65%) center/22px 22px no-repeat}
.sv .sv-timeline[data-soft-timeline] .sv-seek input:focus-visible::-moz-range-thumb{background:linear-gradient(var(--sv-text),var(--sv-text)) center/6px 12px no-repeat,radial-gradient(circle,color-mix(in srgb,var(--sv-text) 18%,transparent) 60%,transparent 65%) center/22px 22px no-repeat}
.sv .sv-timeline[data-soft-timeline] .sv-segments{top:18px;height:8px;border:0;border-radius:5px;background:var(--sv-input)}
.sv .sv-timeline[data-soft-timeline] .sv-chapter{height:8px;padding-right:0}
.sv .sv-timeline[data-soft-timeline] .sv-chapter :is(button,[role=button])::before{height:5px;border:0;border-radius:4px;background:linear-gradient(to right,color-mix(in srgb,var(--sv-green) 45%,transparent) var(--chapter-progress),color-mix(in srgb,var(--sv-muted) 20%,transparent) var(--chapter-progress))}
.sv .sv-timeline[data-soft-timeline] .sv-chapter.current :is(button,[role=button])::before{background:linear-gradient(to right,color-mix(in srgb,var(--sv-green) 65%,transparent) var(--chapter-progress),color-mix(in srgb,var(--sv-green) 20%,transparent) var(--chapter-progress))}
.sv .sv-timeline[data-soft-timeline] .sv-chapter:has(:focus-visible){outline:1px solid var(--sv-muted);outline-offset:3px;border-radius:4px}
.sv .sv-timeline[data-soft-timeline] .sv-contact-markers{top:38px}
.sv .sv-timeline[data-soft-timeline] .sv-timeline-caption{font-size:11px;gap:8px}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek{height:72px}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-bench-time-rail{position:absolute;inset:20px 0 auto;height:4px;border-radius:999px;background:color-mix(in srgb,var(--sv-green) 22%,var(--sv-input));pointer-events:none;overflow:hidden}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-bench-time-rail>i{display:block;height:100%;border-radius:inherit;background:var(--sv-green)}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-bench-playhead{position:absolute;top:15px;width:14px;height:14px;border-radius:50%;transform:translateX(-50%);background:var(--sv-text);box-shadow:0 0 0 3px color-mix(in srgb,var(--sv-text) 12%,transparent);z-index:6;pointer-events:none}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek:has(input:is(:hover,:focus-visible)) .sv-bench-playhead,.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true][data-scrubbing=true] .sv-bench-playhead{box-shadow:0 0 0 5px color-mix(in srgb,var(--sv-text) 16%,transparent)}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-segments{top:18px;background:transparent}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-chapter :is(button,[role=button])::before{content:none}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-chapter:has(:focus-visible){outline:none;box-shadow:0 2px 0 var(--sv-muted)}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek:has(input:focus-visible) .sv-bench-playhead{outline:1px solid var(--sv-muted);outline-offset:3px}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek input{z-index:4;left:-22px;right:auto;width:calc(100% + 44px)}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek input::-webkit-slider-thumb{background:transparent;border:0;border-radius:0;margin-top:-19.5px}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek input::-moz-range-thumb{background:transparent;border:0;border-radius:0}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek input:is(:hover,:focus-visible)::-webkit-slider-thumb{background:transparent}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-seek input:focus-visible::-moz-range-thumb{background:transparent}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-contact-markers{top:0;height:44px;z-index:5}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] :is(.sv-marker,.sv-point-marker){opacity:1;touch-action:none}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-timeline-symbol{position:relative;display:block;width:12px;height:12px}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-timeline-dot{display:block;position:absolute;left:4px;top:4px;width:4px;height:4px;border:0;border-radius:50%;box-shadow:none}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-timeline-marker-legend{position:absolute;top:20px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:3px;width:max-content;min-height:18px;padding:1px 4px;border:1px solid var(--sv-line);border-radius:4px;background:var(--sv-input);font-size:11px;line-height:14px;font-weight:400;color:var(--sv-text);white-space:nowrap;user-select:none;pointer-events:auto}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-timeline-marker-legend::before{content:'';position:absolute;left:50%;top:-4px;width:6px;height:6px;transform:translateX(-50%) rotate(45deg);border-top:1px solid var(--sv-line);border-left:1px solid var(--sv-line);background:var(--sv-input);pointer-events:none}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-timeline-marker-legend>span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] .sv-timeline-marker-legend>small{flex:none;font-size:10px;line-height:14px;color:var(--sv-muted)}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] :is(.sv-marker,.sv-point-marker):has(:is(button,[role=button]):is(:hover,:focus-visible)) .sv-timeline-marker-legend{border-color:var(--sv-muted)}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] :is(.sv-marker,.sv-point-marker):has(:is(button,[role=button]):focus-visible) .sv-timeline-dot{box-shadow:0 0 0 2px var(--sv-panel),0 0 0 3px var(--sv-muted)}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] :is(.sv-marker,.sv-point-marker) .sv-action :is(button,[role=button]):focus-visible{outline:none}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] :is(.sv-marker,.sv-point-marker) .sv-action :is(button,[role=button]){min-width:44px!important;width:44px!important;overflow:visible!important;transform:none!important}
.sv.sv-bench .sv-timeline[data-soft-timeline][data-bench=true] :is(.sv-marker,.sv-point-marker) .sv-action :is(button,[role=button])::before{content:none!important}
.sv.sv-bench .sv-player{overflow-x:clip;overflow-y:visible}
`;

export const videoGalleryStyles = `
.sv-gallery-view-toggle,.sv-compact-menu-tools{display:none}
@container scouting-video-bench (max-width:420px){
 .sv .sv-gallery[data-bench=true] .sv-gallery-views,.sv .sv-gallery[data-bench=true] .sv-gallery-tools-trigger{display:none}
 .sv .sv-gallery[data-bench=true] .sv-gallery-view-toggle,.sv .sv-gallery[data-bench=true] .sv-compact-menu-tools{display:block}
}

.sv .sv-gallery[data-bench=true]{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0 12px;padding:10px;background:var(--sv-panel);border:1px solid var(--sv-line);border-radius:12px;min-width:0;container-type:inline-size;container-name:bench-gallery}
.sv .sv-gallery[data-bench=true] .sv-gallery-head{gap:6px;flex-wrap:wrap;min-width:0}.sv .sv-gallery[data-bench=true] .sv-gallery-head h2{flex:1 1 auto;font-size:16px;line-height:20px;font-weight:600;margin:0}
.sv .sv-gallery[data-bench=true] .sv-action{font-size:14px;line-height:20px}.sv .sv-gallery[data-bench=true] .sv-badge{font-size:12px;line-height:16px}
.sv .sv-gallery[data-bench=true] .sv-gallery-filters{margin:0;min-width:0;gap:4px;flex-wrap:nowrap}.sv .sv-gallery[data-bench=true] .sv-gallery-filters>.sv-select{min-width:120px;flex:1}
.sv .sv-gallery[data-bench=true]>.sv-gallery-head,.sv .sv-gallery[data-bench=true]>.sv-gallery-filters{margin-bottom:8px}
.sv .sv-gallery[data-bench=true] .sv-gallery-filters :is(button,[role=button])>:first-child{font-size:13px!important;line-height:18px!important}
.sv .sv-gallery[data-bench=true] .sv-grid{grid-column:1/-1;display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;margin:0;padding:0 0 4px;scrollbar-width:thin;overscroll-behavior-x:contain;scroll-snap-type:x proximity;max-width:100%}
.sv .sv-gallery[data-bench=true] .sv-rally{width:128px;flex:0 0 128px;scroll-snap-align:start;border-radius:8px}
.sv .sv-gallery[data-bench=true][data-layout=thumbnails] .sv-caption small+small{display:none}
.sv .sv-gallery[data-bench=true] .sv-caption{padding:4px 40px 4px 6px;display:grid;gap:0;font-size:13px;line-height:18px;min-height:44px}.sv .sv-gallery[data-bench=true] .sv-caption b{font-size:13px;line-height:18px;font-weight:600}.sv .sv-gallery[data-bench=true] .sv-caption small{margin:0;font-size:12px;line-height:16px}
.sv .sv-gallery[data-bench=true] .sv-caption :is(b,small){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv .sv-gallery[data-bench=true] .sv-rally-result{display:none}.sv .sv-gallery[data-bench=true] .sv-download{top:auto;bottom:4px;right:2px;background:transparent}
.sv .sv-gallery[data-bench=true] .sv-section-meta,.sv .sv-gallery[data-bench=true]>.sv-row:not(.sv-gallery-head){grid-column:1/-1}
.sv .sv-gallery[data-bench=true] :is(.sv-section-meta,.sv-gallery-empty){font-size:12px;line-height:18px}
.sv .sv-gallery[data-bench=true][data-layout=list] .sv-grid{display:grid;grid-template-columns:minmax(0,1fr);max-height:240px;overflow:auto}.sv .sv-gallery[data-bench=true][data-layout=list] .sv-rally{width:auto;flex:none;border:0;border-bottom:1px solid var(--sv-line);border-radius:0}
.sv .sv-gallery[data-bench=true][data-layout=list] .sv-rally-content{min-height:60px;padding:4px 44px 4px 4px}.sv .sv-gallery[data-bench=true][data-layout=list] .sv-rally-preview{width:72px;flex-basis:72px}.sv .sv-gallery[data-bench=true][data-layout=list] .sv-caption{padding:0;min-height:44px}
.sv .sv-gallery[data-bench=true][data-layout=list] .sv-download{top:50%;bottom:auto;translate:0 -50%}
@container scouting-video-bench (max-width:620px){.sv .sv-gallery[data-bench=true]{grid-template-columns:minmax(0,1fr)}.sv .sv-gallery[data-bench=true] .sv-gallery-filters{grid-column:1/-1}}
.sv .sv-gallery{min-width:0;container:video-gallery/inline-size}
.sv .sv-gallery-head{gap:8px;flex-wrap:wrap}.sv .sv-gallery-head h2{font-size:16px}.sv-gallery-views{display:flex;align-items:center;gap:0;margin-left:auto}
.sv .sv-gallery-views .sv-action :is(button,[role=button]){min-height:44px!important;min-width:44px!important;border:0!important;background:transparent!important;padding:8px!important}
.sv .sv-gallery-views .sv-action :is(button,[role=button])[aria-pressed=true]{background:var(--sv-input)!important}
.sv .sv-gallery-filters{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.sv-gallery-filters>.sv-select{flex:1;min-width:0}.sv-gallery-filters .sv-select :is(button,[role=button]){min-height:44px!important}
.sv .sv-gallery .sv-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.sv .sv-gallery .sv-rally{border-color:var(--sv-line);background:transparent}.sv .sv-gallery .sv-rally.selected{border-color:var(--sv-green);background:var(--sv-input)}
.sv .sv-gallery .sv-caption{font-size:12px;gap:3px}.sv .sv-gallery .sv-caption small{font-size:11px;white-space:normal;line-height:16px}
.sv .sv-gallery .sv-download :is(button,[role=button]){min-height:44px!important;min-width:44px!important;padding:8px!important}
.sv .sv-gallery[data-bench=true] .sv-download :is(button,[role=button]){border:0!important;border-radius:50%!important;background:transparent!important;box-shadow:none!important}
.sv .sv-gallery[data-bench=true] .sv-download :is(button,[role=button]):is(:hover,:focus-visible){background:radial-gradient(circle,var(--sv-input) 14px,transparent 14.5px)!important}
.sv .sv-gallery .sv-full-video{grid-column:1/-1;min-height:44px;border:0;border-bottom:1px solid var(--sv-line);border-radius:0;background:transparent}
.sv .sv-gallery .sv-full-video .sv-rally-content{flex-direction:row;align-items:center;min-height:44px;gap:8px}.sv .sv-gallery .sv-full-video .sv-thumb{width:44px;height:28px;aspect-ratio:auto;flex:none;border-radius:4px}.sv .sv-gallery .sv-full-video .sv-caption{padding:6px;flex-direction:row;flex:1;align-items:center;justify-content:space-between}
.sv .sv-gallery[data-layout=list] .sv-grid{grid-template-columns:minmax(0,1fr)}
.sv .sv-gallery[data-layout=list] .sv-rally-content{flex-direction:row;align-items:center;min-height:76px;padding:6px 44px 6px 6px;gap:8px}.sv .sv-gallery[data-layout=list] .sv-rally-preview{width:88px;flex:0 0 88px}.sv .sv-gallery[data-layout=list] .sv-caption{padding:0;flex:1}.sv .sv-gallery[data-layout=list] .sv-download{top:50%;right:0;translate:0 -50%}.sv .sv-gallery[data-layout=list] .sv-full-video .sv-rally-content{min-height:44px;padding:0}
.sv .sv-gallery-empty{grid-column:1/-1;font-size:11px;color:var(--sv-muted);padding:12px 0}
@container video-gallery (max-width:249px){.sv .sv-gallery .sv-grid{grid-template-columns:minmax(0,1fr)}}
`;
