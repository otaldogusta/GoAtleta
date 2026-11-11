import { assertSessionIdentity, getSessionIdentity } from '../auth/session';
import { getActiveOrganizationId, supabasePost } from '../db/client';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export type PhoneVideoPairScope = { org: string; classId: string; sessionId: string };

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const proof = /^[a-f0-9]{64}$/;
const contextKey = /^[^\u0000-\u001f\u007f]{1,200}$/;
const closed = () => new Error('Este QR expirou ou foi fechado. Gere outro no notebook.');
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

const validDescription = (value: unknown): value is string =>
    typeof value === 'string' && value.length >= 16 && new TextEncoder().encode(value).length <= 16384;

function checkAbort(signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Pareamento cancelado.', 'AbortError');
}

function hostError(error: unknown): never {
    const message = error instanceof Error ? error.message : '';
    if (/\b(?:PGRST202|42883)\b/.test(message)) throw new Error('O envio por Wi-Fi ainda precisa ser ativado no servidor.');
    if (/\bPT429\b/.test(message)) throw new Error('Aguarde um minuto antes de gerar outro QR.');
    if (/\bPT410\b/.test(message)) throw closed();
    if (/\b42501\b/.test(message)) throw new Error('Sua conta não pode receber vídeo nesta análise.');
    if (error instanceof Error && error.name === 'SessionIdentityChangedError') throw error;
    throw new Error('Não foi possível conectar o celular. Confira a conexão e tente novamente.');
}

async function hostRpc<T>(scope: PhoneVideoPairScope, id: string, operation: 'create' | 'read_answer' | 'close', signal?: AbortSignal, fields = {}) {
    const identity = getSessionIdentity();
    const assertContext = () => { checkAbort(signal); assertSessionIdentity(identity); };
    assertContext();
    if (!identity.userId || !uuid.test(scope.org) || !uuid.test(id) || !contextKey.test(scope.classId) || !contextKey.test(scope.sessionId)) {
        throw new Error('Abra uma análise para receber o vídeo.');
    }
    // Closing an earlier room is allowed after switching the active organization.
    if (operation !== 'close' && await getActiveOrganizationId() !== scope.org) throw new Error('A organização mudou. Reabra a análise.');
    let result: T;
    try {
        result = await supabasePost<T>(`/rpc/scouting_phone_video_${operation}`, {
            p_org: scope.org, p_class: scope.classId, p_session: scope.sessionId, p_id: id, ...fields,
        }, undefined, identity, assertContext);
    } catch (error) {
        checkAbort(signal);
        return hostError(error);
    }
    if (operation !== 'close' && await getActiveOrganizationId() !== scope.org) throw new Error('A organização mudou. Reabra a análise.');
    assertContext();
    return result;
}

export async function createPhoneVideoPairing(scope: PhoneVideoPairScope, offer: string, signal: AbortSignal): Promise<{ id: string; code: string; expiresAt: number }> {
    checkAbort(signal);
    if (!validDescription(offer)) throw new Error('Não foi possível preparar o pareamento por Wi-Fi.');
    const id = crypto.randomUUID();
    const code = hex(crypto.getRandomValues(new Uint8Array(32)));
    const hash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))));
    try {
        const expiry = await hostRpc<unknown>(scope, id, 'create', signal, { p_proof_hash: hash, p_offer: offer });
        const expiresAt = typeof expiry === 'string' ? Date.parse(expiry) : NaN;
        if (!Number.isFinite(expiresAt)) throw new Error('Não foi possível confirmar o pareamento.');
        return { id, code, expiresAt };
    } catch (error) {
        // The create may have committed before cancellation or a lost response.
        void closePhoneVideoPairing(scope, id).catch(() => undefined);
        throw error;
    }
}

export async function readPhoneVideoAnswer(scope: PhoneVideoPairScope, id: string, signal: AbortSignal): Promise<string | null> {
    const result = await hostRpc<{ answer?: unknown } | null>(scope, id, 'read_answer', signal);
    if (result?.answer === null || validDescription(result?.answer)) return result.answer;
    throw closed();
}

export async function closePhoneVideoPairing(scope: PhoneVideoPairScope, id: string): Promise<void> {
    await hostRpc(scope, id, 'close');
}

async function guestRpc(operation: 'offer' | 'answer', id: string, code: string, signal: AbortSignal, answer?: string): Promise<unknown> {
    checkAbort(signal);
    if (!uuid.test(id) || !proof.test(code)) throw closed();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Envio por Wi-Fi indisponível.');
    const request = new AbortController();
    const abort = () => request.abort(signal.reason);
    const timeout = setTimeout(() => request.abort(), 10000);
    signal.addEventListener('abort', abort, { once: true });
    try {
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/scouting_phone_video_${operation}`, {
            method: 'POST', signal: request.signal, cache: 'no-store', referrerPolicy: 'no-referrer',
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_id: id, p_proof: code, ...(answer === undefined ? {} : { p_answer: answer }) }),
        });
        if (!response.ok) throw new Error('Serviço indisponível');
        const result: unknown = await response.json();
        checkAbort(signal);
        return result;
    } catch {
        checkAbort(signal);
        throw new Error('Não foi possível acessar o pareamento. Confira a conexão e tente novamente.');
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}

export async function readPhoneVideoOffer(id: string, code: string, signal: AbortSignal): Promise<string> {
    const offer = await guestRpc('offer', id, code, signal);
    if (!validDescription(offer)) throw closed();
    return offer;
}

export async function answerPhoneVideoPairing(id: string, code: string, answer: string, signal: AbortSignal): Promise<void> {
    if (!validDescription(answer)) throw new Error('Não foi possível preparar a conexão por Wi-Fi.');
    if (await guestRpc('answer', id, code, signal, answer) !== true) throw closed();
}
