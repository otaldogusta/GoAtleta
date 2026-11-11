import {
    answerPhoneVideoPairing, closePhoneVideoPairing, createPhoneVideoPairing,
    readPhoneVideoAnswer, readPhoneVideoOffer, type PhoneVideoPairScope,
} from '../../../api/scouting-phone-video';
import { phoneVideoLanSdp, phoneVideoLocalAddress } from './phone-video-sdp';
import { receivePhoneVideo, type PhoneVideoOffer, type PhoneVideoReceived } from './phone-video-transfer.web';

const channelLabel = 'goatleta-phone-mp4-v1';
const lanError = 'Não foi possível conectar. Confira se os dois aparelhos estão na mesma rede Wi-Fi.';
const timeoutError = 'O QR expirou. Gere outro código no computador.';

type ReceiveOptions = {
    signal: AbortSignal;
    accept: (offer: PhoneVideoOffer) => Promise<boolean>;
    onProgress?: (bytes: number, total: number) => void;
};

function sleep(ms: number, signal: AbortSignal) {
    signal.throwIfAborted();
    return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

async function waitFor(peer: RTCPeerConnection, ready: () => boolean, signal: AbortSignal, ms: number) {
    const until = Date.now() + ms;
    while (!ready()) {
        if (Date.now() >= until || peer.connectionState === 'failed' || peer.connectionState === 'closed') {
            signal.throwIfAborted();
            throw new Error(lanError);
        }
        await sleep(100, signal);
    }
    signal.throwIfAborted();
}

async function localSdp(peer: RTCPeerConnection, description: RTCSessionDescriptionInit, signal: AbortSignal) {
    await peer.setLocalDescription(description);
    await waitFor(peer, () => peer.iceGatheringState === 'complete', signal, 10_000);
    return phoneVideoLanSdp(peer.localDescription?.sdp ?? '');
}

function openPeer(signal: AbortSignal) {
    signal.throwIfAborted();
    if (!globalThis.isSecureContext || typeof RTCPeerConnection !== 'function') {
        throw new Error('Abra o Go Atleta em um navegador compatível com envio direto.');
    }
    const peer = new RTCPeerConnection({ iceServers: [] });
    const close = () => {
        signal.removeEventListener('abort', close);
        peer.close();
    };
    signal.addEventListener('abort', close, { once: true });
    return { peer, close };
}

async function openChannel(peer: RTCPeerConnection, channel: () => RTCDataChannel | undefined, signal: AbortSignal) {
    await waitFor(peer, () => channel()?.readyState === 'open', signal, 25_000);
    const stats = await peer.getStats();
    signal.throwIfAborted();
    const entries = [...stats.values()];
    const transport = entries.find(entry => entry.type === 'transport' && entry.selectedCandidatePairId);
    const pair = transport ? stats.get(transport.selectedCandidatePairId) :
        entries.find(entry => entry.type === 'candidate-pair' && entry.nominated && entry.state === 'succeeded');
    const isLan = (type: unknown, address: unknown) => typeof address === 'string' && address.length > 0
        ? (type === 'host' || type === 'prflx') && phoneVideoLocalAddress(address)
        : type === 'host';
    if (!pair || ![pair.localCandidateId, pair.remoteCandidateId].every(id => {
        const candidate = stats.get(id);
        return isLan(candidate?.candidateType, candidate?.address);
    })) throw new Error(lanError);
    const ice = peer.sctp?.transport?.iceTransport;
    ice?.addEventListener('selectedcandidatepairchange', () => {
        const selected = ice.getSelectedCandidatePair?.();
        if (selected && [selected.local, selected.remote].some(candidate => !isLan(candidate.type, candidate.address))) peer.close();
    });
    return channel()!;
}

export async function startPhoneVideoReception(scope: PhoneVideoPairScope, options: ReceiveOptions): Promise<{
    url: string;
    expiresAt: number;
    file: Promise<PhoneVideoReceived>;
}> {
    const { signal } = options;
    if (typeof navigator.storage?.getDirectory !== 'function') {
        throw new Error('Este navegador não oferece espaço de trabalho para receber o original.');
    }
    const { peer, close } = openPeer(signal);
    try {
        const channel = peer.createDataChannel(channelLabel);
        const offer = await localSdp(peer, await peer.createOffer(), signal);
        const pairing = await createPhoneVideoPairing(scope, offer, signal);
        const url = new URL('/scouting/enviar-video', window.location.origin);
        url.hash = new URLSearchParams({ id: pairing.id, code: pairing.code }).toString();
        let revocation: Promise<void> | undefined;
        const revoke = () => {
            revocation ??= closePhoneVideoPairing(scope, pairing.id).catch(() => undefined);
        };
        signal.addEventListener('abort', revoke, { once: true });
        if (signal.aborted) revoke();

        const file = (async () => {
            try {
                while (Date.now() < pairing.expiresAt) {
                    const answer = await readPhoneVideoAnswer(scope, pairing.id, signal);
                    if (answer) {
                        const verified = (async () => {
                            await peer.setRemoteDescription({ type: 'answer', sdp: phoneVideoLanSdp(answer) });
                            await openChannel(peer, () => channel, signal);
                        })();
                        const received = receivePhoneVideo(channel, {
                            ...options,
                            accept: async offer => {
                                await verified;
                                return options.accept(offer);
                            },
                        });
                        void received.catch(() => undefined);
                        await verified;
                        revoke();
                        return await received;
                    }
                    await sleep(1500, signal);
                }
                throw new Error(timeoutError);
            } finally {
                signal.removeEventListener('abort', revoke);
                revoke();
                close();
            }
        })();
        void file.catch(() => undefined);
        return { url: url.toString(), expiresAt: pairing.expiresAt, file };
    } catch (failure) {
        close();
        throw failure;
    }
}

export async function connectPhoneVideoSender(id: string, code: string, signal: AbortSignal) {
    const { peer, close } = openPeer(signal);
    try {
        let channel: RTCDataChannel | undefined;
        peer.ondatachannel = event => {
            if (channel || event.channel.label !== channelLabel || !event.channel.ordered) {
                event.channel.close();
                return;
            }
            channel = event.channel;
            channel.addEventListener('close', close, { once: true });
        };
        const offer = await readPhoneVideoOffer(id, code, signal);
        await peer.setRemoteDescription({ type: 'offer', sdp: phoneVideoLanSdp(offer) });
        const answer = await localSdp(peer, await peer.createAnswer(), signal);
        await answerPhoneVideoPairing(id, code, answer, signal);
        return await openChannel(peer, () => channel, signal);
    } catch (failure) {
        close();
        throw failure;
    }
}
