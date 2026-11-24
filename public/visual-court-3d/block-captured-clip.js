import { blockClip } from './swing-block-data.js';

export const blockTorso = Object.freeze({pitch:0,chestYaw:1,pelvisYaw:26,gazeYaw:27,load:28});

export function blockClipValue(frame, index) {
 const clamped=Math.max(1,Math.min(blockClip.length,frame));
 const a=Math.floor(clamped)-1,b=Math.min(a+1,blockClip.length-1);
 return blockClip[a][index]+(blockClip[b][index]-blockClip[a][index])*(clamped-a-1);
}
