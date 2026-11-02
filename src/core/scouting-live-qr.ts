import qrcode from 'qrcode-generator';

/** Encoded locally: a pairing capability is never sent to a QR-generation service. */
export function liveQrSvg(value: string): string {
    if (value.length > 2048) throw new Error('Link de câmera muito longo.');
    const url = new URL(value);
    if (!(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) || url.username || url.password || !url.hash) throw new Error('Link seguro de câmera inválido.');
    const code = qrcode(0,'M'); code.addData(value,'Byte'); code.make();
    return code.createSvgTag({ cellSize:4, margin:16, scalable:true });
}
