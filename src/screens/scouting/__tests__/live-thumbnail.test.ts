import {captureLiveThumbnail,isLiveThumbnailDataUrl,LIVE_THUMBNAIL_MAX_LENGTH} from '../live/live-thumbnail';

const image='data:image/jpeg;base64,/9j/AAAA';
function canvasFixture(){
    const context={drawImage:jest.fn()},canvas={width:0,height:0,getContext:jest.fn(()=>context),toDataURL:jest.fn(()=>image)};
    const document={createElement:jest.fn(()=>canvas)} as unknown as Pick<Document,'createElement'>;
    return {context,canvas,document};
}
const frame=(width=1920,height=1080)=>({readyState:2,videoWidth:width,videoHeight:height}) as HTMLVideoElement;

test('local posters accept only bounded JPEG base64 data and never remote or executable image sources',()=>{
    expect(isLiveThumbnailDataUrl(image)).toBe(true);
    for(const value of ['https://example.com/image.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,invalid!','data:image/jpeg;base64,AAAA',image+'A','data:image/jpeg;base64,/9j/'+ 'AAAA'.repeat(LIVE_THUMBNAIL_MAX_LENGTH),null])expect(isLiveThumbnailDataUrl(value)).toBe(false);
});

test('capture preserves frame proportions within 320 by 180 without upscaling',()=>{
    for(const [width,height,expected] of [[1920,1080,[320,180]],[1080,1920,[101,180]],[120,60,[120,60]]]){
        const {document,canvas,context}=canvasFixture();
        expect(captureLiveThumbnail(frame(width,height),document)).toBe(image);
        expect([canvas.width,canvas.height]).toEqual(expected);
        expect(context.drawImage).toHaveBeenCalledWith(expect.anything(),0,0,...expected);
        expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg',.65);
    }
});

test('unavailable frames and canvas failures do not produce a blank poster or throw into the recording flow',()=>{
    const {document,canvas}=canvasFixture();
    expect(captureLiveThumbnail(frame(0,0),document)).toBeNull();expect(document.createElement).not.toHaveBeenCalled();
    expect(captureLiveThumbnail({...frame(),readyState:1} as HTMLVideoElement,document)).toBeNull();
    canvas.toDataURL.mockImplementation(()=>{throw new Error('Canvas unavailable');});
    expect(captureLiveThumbnail(frame(),document)).toBeNull();
    canvas.toDataURL.mockReturnValue('data:image/png;base64,AAAA');expect(captureLiveThumbnail(frame(),document)).toBeNull();
});
