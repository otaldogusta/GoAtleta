/** Native-density rendering, bounded to 2× rather than stretching a stale buffer. */
export function renderPixelRatio(value){return Math.min(2,Math.max(1,Number.isFinite(value)?value:1));}

/** A monitor, browser zoom or viewport change can alter DPR without changing CSS size. */
export function syncRendererResolution(renderer,width,height,deviceRatio){
 const pixelRatio=renderPixelRatio(deviceRatio),w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
 let changed=false;
 if(renderer.getPixelRatio()!==pixelRatio){renderer.setPixelRatio(pixelRatio);changed=true;}
 const size=renderer.getSize({set(x,y){return {width:x,height:y};}});
 if(size.width!==w||size.height!==h){renderer.setSize(w,h,false);changed=true;}
 return {width:w,height:h,pixelRatio,changed};
}
