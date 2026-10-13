/** Present decoded pixels on a regular layer when Chromium loses its video surface.
 * The media element remains the only decoder, clock and audio source.
 */
export function presentVideoFrames(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) return () => undefined;
    let stopped = false, frame = 0, animation = 0;
    const clear = () => context.clearRect(0, 0, canvas.width, canvas.height);
    const draw = () => {
        if (stopped || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
        // Bound the presentation buffer; the source media and exports keep their resolution.
        const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.round(video.videoWidth * scale), height = Math.round(video.videoHeight * scale);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        try { context.drawImage(video, 0, 0, width, height); }
        catch { /* Preserve the last presented frame during a transient decode/seek. */ }
    };
    const nextFrame = () => {
        if (stopped) return;
        draw();
        frame = video.requestVideoFrameCallback(nextFrame);
    };
    const nextAnimation = () => {
        if (stopped) return;
        if (!video.paused) draw();
        animation = requestAnimationFrame(nextAnimation);
    };
    const refreshEvents = ['loadeddata', 'seeked', 'pause', 'timeupdate'] as const;
    const clearEvents = ['emptied', 'loadstart', 'error'] as const;
    refreshEvents.forEach(event => video.addEventListener(event, draw));
    clearEvents.forEach(event => video.addEventListener(event, clear));
    const refreshVisible = () => { if (!video.ownerDocument.hidden) draw(); };
    video.ownerDocument.addEventListener('visibilitychange', refreshVisible);
    if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(nextFrame);
    else animation = requestAnimationFrame(nextAnimation);
    draw();
    return () => {
        stopped = true;
        if (frame) video.cancelVideoFrameCallback(frame);
        if (animation) cancelAnimationFrame(animation);
        refreshEvents.forEach(event => video.removeEventListener(event, draw));
        clearEvents.forEach(event => video.removeEventListener(event, clear));
        video.ownerDocument.removeEventListener('visibilitychange', refreshVisible);
        clear();
    };
}
