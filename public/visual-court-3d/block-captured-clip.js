import { blockClip } from './block-captured-data.js';

export function blockClipValue(frame, index) {
 const clamped=Math.max(1,Math.min(blockClip.length,frame));
 const a=Math.floor(clamped)-1,b=Math.min(a+1,blockClip.length-1);
 return blockClip[a][index]+(blockClip[b][index]-blockClip[a][index])*(clamped-a-1);
}
