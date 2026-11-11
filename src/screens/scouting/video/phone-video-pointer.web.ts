type Scope = { userId: string; org: string; classId: string; sessionId: string };

export type PhoneVideoPointer = {
    storageId: string;
    name: string;
    bytes: number;
    analysisFingerprint: string;
    fileFingerprint: string;
    kind: 'direct' | 'youtube-original';
};

const fingerprint = /^[0-9a-f]{64}$/;
const storageId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function phoneVideoPointerKey({ userId, org, classId, sessionId }: Scope): string | null {
    const values = [userId, org, classId, sessionId];
    if (values.some(value => !value || value.length > 300)) return null;
    return `goatleta:scouting-phone-video:v1:${values.map(encodeURIComponent).join(':')}`;
}

function valid(value: unknown): value is PhoneVideoPointer {
    if (!value || typeof value !== 'object') return false;
    const pointer = value as Partial<PhoneVideoPointer>;
    return typeof pointer.storageId === 'string' && storageId.test(pointer.storageId)
        && typeof pointer.name === 'string' && pointer.name.length <= 180 && /^.+\.mp4$/i.test(pointer.name) && !/[/\\\x00-\x1f\x7f]/.test(pointer.name)
        && typeof pointer.bytes === 'number' && Number.isSafeInteger(pointer.bytes) && pointer.bytes > 0 && pointer.bytes <= 24 * 1024 ** 3
        && typeof pointer.fileFingerprint === 'string' && fingerprint.test(pointer.fileFingerprint)
        && typeof pointer.analysisFingerprint === 'string'
        && (pointer.kind === 'direct' && pointer.analysisFingerprint === pointer.fileFingerprint
            || pointer.kind === 'youtube-original' && /^youtube:[\w-]{11}$/.test(pointer.analysisFingerprint));
}

export function readPhoneVideoPointer(key: string | null): PhoneVideoPointer | null {
    if (!key) return null;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw || raw.length > 4096) return null;
        const value = JSON.parse(raw);
        return value?.version === 1 && value.scopeKey === key && valid(value.pointer) ? value.pointer : null;
    } catch { return null; }
}

export function savePhoneVideoPointer(key: string | null, pointer: PhoneVideoPointer): boolean {
    if (!key || !valid(pointer)) return false;
    try {
        window.localStorage.setItem(key, JSON.stringify({ version: 1, scopeKey: key, pointer }));
        return true;
    } catch { return false; }
}
