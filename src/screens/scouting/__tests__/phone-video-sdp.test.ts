import { phoneVideoLanSdp, phoneVideoLocalAddress } from '../video/phone-video-sdp';

const candidate = (address: string, type = 'host') =>
    `a=candidate:123 1 udp 2122260223 ${address} 51234 typ ${type} generation 0`;

const description = (...candidates: string[]) => [
    'v=0', 'o=- 12 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
    'm=application 51234 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 203.0.113.1',
    ...candidates, 'a=ice-ufrag:abc', 'a=sctp-port:5000', '',
].join('\r\n');

test('only announces local host candidates and clears the SDP default connection address', () => {
    const sdp = phoneVideoLanSdp(description(
        candidate('192.168.1.13'), candidate('abc-12.local'), candidate('fd00::5'),
        candidate('2001:db8::1'), candidate('203.0.113.5'), candidate('192.168.1.16', 'relay'),
    ));
    expect(sdp).toContain('m=application 9 UDP/DTLS/SCTP webrtc-datachannel');
    expect(sdp).toContain('c=IN IP4 0.0.0.0');
    expect(sdp).toContain('192.168.1.13');
    expect(sdp).toContain('abc-12.local');
    expect(sdp).toContain('fd00::5');
    expect(sdp).not.toMatch(/203\.0\.113|2001:db8|192\.168\.1\.16|generation/);
});

test('fails with no usable local candidate and rejects media sections', () => {
    expect(() => phoneVideoLanSdp(description(candidate('8.8.8.8')))).toThrow('rede local');
    expect(() => phoneVideoLanSdp(description(candidate('192.168.1.2'), 'm=video 9 UDP/TLS/RTP/SAVPF 96'))).toThrow('inválido');
    expect(phoneVideoLocalAddress('172.31.3.4')).toBe(true);
    expect(phoneVideoLocalAddress('172.32.3.4')).toBe(false);
    expect(phoneVideoLocalAddress('192.168.1.256')).toBe(false);
    expect(phoneVideoLocalAddress('fe80::1234')).toBe(true);
});
