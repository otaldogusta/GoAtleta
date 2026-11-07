import type { VideoDocument } from '../../../core/scouting-video';
import type { LocalStudioSource, StudioRangeResolver } from './local-studio-types';

/** Capture-clock range covered by this source. Final padding may end at EOF. */
export function localStudioMediaRange(doc:VideoDocument,id:string,local:LocalStudioSource,resolve:StudioRangeResolver) {
    const [start,wantedEnd]=resolve(doc,id);
    const end=Math.min(wantedEnd,local.availableUntilSeconds);
    const rally=doc.rallies.find(value=>value.id===id);
    const gestures=[rally?.pointTime,...local.draft.sourceContacts.filter(value=>value.rallyId===id).map(value=>value.time),...doc.contacts.filter(value=>value.time>=start&&value.time<wantedEnd).map(value=>value.time)].filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
    const finalPadding=local.original&&gestures.length>0&&gestures.every(value=>value>=start&&value<=end);
    const complete=start>=local.offsetSeconds&&end>start&&(wantedEnd<=local.availableUntilSeconds+.001||finalPadding);
    return {start,end,complete};
}
