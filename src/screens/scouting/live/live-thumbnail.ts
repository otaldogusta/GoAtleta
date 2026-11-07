/** A small local JPEG poster, never a remotely loaded image or a copy of the video. */
export const LIVE_THUMBNAIL_MAX_LENGTH = 80000;

export function isLiveThumbnailDataUrl(value:unknown):value is string {
    return typeof value==='string'&&value.length<=LIVE_THUMBNAIL_MAX_LENGTH
        &&/^data:image\/jpeg;base64,\/9j\/(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

/** Canvas failures and unavailable frames are optional preview failures, not capture failures. */
export function captureLiveThumbnail(video:HTMLVideoElement,ownerDocument:Pick<Document,'createElement'>|undefined=typeof document==='undefined'?undefined:document):string|null {
    if(!ownerDocument||video.readyState<2||!Number.isFinite(video.videoWidth)||!Number.isFinite(video.videoHeight)||video.videoWidth<=0||video.videoHeight<=0)return null;
    try{
        const ratio=Math.min(1,320/video.videoWidth,180/video.videoHeight),canvas=ownerDocument.createElement('canvas');
        canvas.width=Math.max(1,Math.round(video.videoWidth*ratio));canvas.height=Math.max(1,Math.round(video.videoHeight*ratio));
        const context=canvas.getContext('2d',{alpha:false});if(!context)return null;
        context.drawImage(video,0,0,canvas.width,canvas.height);
        const image=canvas.toDataURL('image/jpeg',.65);
        return isLiveThumbnailDataUrl(image)?image:null;
    }catch{return null;}
}
