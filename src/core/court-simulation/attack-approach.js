import {acrossMm,forwardMm} from './attack-approach-data.js';

const last=forwardMm.length-1;
const distanceMm=forwardMm[last]-forwardMm[0];
export const CAPTURED_APPROACH_METRES=distanceMm/1000;

function sampleMillimetres(channel,frame){
 const sample=Math.max(0,Math.min(last,frame-12));
 const index=Math.min(last-1,Math.floor(sample));
 return channel[index]+(channel[index+1]-channel[index])*(sample-index);
}

export function attackApproachProgress(frame){
 return (sampleMillimetres(forwardMm,frame)-forwardMm[0])/distanceMm;
}

export function attackApproachLateral(frame,progress){
 // Remove the drift between the two endpoints. Only the side-to-side weight
 // transfer remains when the author rotates or moves the approach handles.
 const baseline=acrossMm[0]+(acrossMm[last]-acrossMm[0])*progress;
 return (sampleMillimetres(acrossMm,frame)-baseline)/1000;
}
