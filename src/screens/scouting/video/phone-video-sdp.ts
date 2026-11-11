const maximumSdpLength = 16_384;

export function phoneVideoLocalAddress(address: string) {
    if (/^[a-z0-9-]{1,63}\.local$/i.test(address)) return true;
    if (/^(?:f[cd][a-f\d]{2}|fe[89ab][a-f\d]):[a-f\d:]+$/i.test(address)) return true;
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return false;
    const octets = address.split('.').map(Number);
    if (octets.some(value => value > 255)) return false;
    const [first, second] = octets;
    return first === 10 || first === 172 && second >= 16 && second <= 31 ||
        first === 192 && second === 168 || first === 169 && second === 254;
}

function lanCandidate(line: string) {
    const fields = line.split(/ +/);
    const [foundation, component, transport, priority, address, port, typeAttribute, type] = fields;
    return fields.length >= 8 && /^a=candidate:[a-z\d+/]{1,32}$/i.test(foundation) && component === '1' &&
        transport.toLowerCase() === 'udp' && /^\d{1,10}$/.test(priority) && phoneVideoLocalAddress(address) &&
        /^\d{1,5}$/.test(port) && Number(port) > 0 && Number(port) <= 65535 && typeAttribute === 'typ' && type === 'host';
}

export function phoneVideoLanSdp(sdp: string) {
    if (sdp.length > maximumSdpLength || !sdp.startsWith('v=0') || /[^\x20-\x7e\r\n]/.test(sdp)) {
        throw new Error('Pareamento de vídeo inválido. Gere outro QR.');
    }
    const lines = sdp.split(/\r?\n/).filter(Boolean);
    const media = lines.filter(line => line.startsWith('m='));
    if (media.length !== 1 || !/^m=application \d{1,5} UDP\/DTLS\/SCTP webrtc-datachannel$/.test(media[0])) {
        throw new Error('Pareamento de vídeo inválido. Gere outro QR.');
    }
    if (!lines.some(lanCandidate)) {
        throw new Error('Não foi possível conectar pela rede local. Confira se os dois aparelhos estão na mesma rede Wi-Fi.');
    }
    return lines.flatMap(line => {
        if (line.startsWith('a=candidate:')) return lanCandidate(line) ? [line.split(/ +/).slice(0, 8).join(' ')] : [];
        if (line.startsWith('a=remote-candidates:')) return [];
        if (line.startsWith('c=')) return ['c=IN IP4 0.0.0.0'];
        if (line.startsWith('m=')) return ['m=application 9 UDP/DTLS/SCTP webrtc-datachannel'];
        return [line];
    }).join('\r\n') + '\r\n';
}
