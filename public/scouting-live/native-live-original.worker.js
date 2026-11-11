const DIRECTORY = 'goatleta-native-live-original-v1';
const MAX_BLOCK_BYTES = 1024 * 1024;
const STORAGE_LIMIT = 'O navegador limitou a gravação no notebook. Use um perfil normal do Chrome e confira o espaço livre.';
const WRITE_LIMIT = `${STORAGE_LIMIT} A cópia parou no último trecho confirmado.`;
let access;

async function digest(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function probeStorage() {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle(DIRECTORY, { create: true });
  const name = `probe-${crypto.randomUUID()}.tmp`;
  const file = await directory.getFileHandle(name, { create: true });
  let check;
  try {
    check = await file.createSyncAccessHandle();
    const sample = new Uint8Array([71, 111, 65, 116]);
    if (check.write(sample, { at: 0 }) !== sample.length) throw new Error(STORAGE_LIMIT);
    check.flush();
    const readback = new Uint8Array(sample.length);
    if (check.read(readback, { at: 0 }) !== sample.length || !sample.every((byte, index) => readback[index] === byte)) {
      throw new Error('O navegador não conseguiu reler a escrita de teste.');
    }
  } finally {
    try { check?.close(); }
    finally { await directory.removeEntry(name).catch(() => undefined); }
  }
}

async function execute(message) {
  if (message.kind === 'probe') return probeStorage();
  if (message.kind === 'open') {
    if (access || !/^[0-9a-f]{64}\.mp4$/.test(message.name)) throw new Error('Arquivo local inválido.');
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(DIRECTORY, { create: true });
    const file = await directory.getFileHandle(message.name, { create: true });
    access = await file.createSyncAccessHandle();
    return access.getSize();
  }
  if (!access) throw new Error('Arquivo local indisponível.');
  if (message.kind === 'close') {
    access.close();
    access = undefined;
    return;
  }
  if (message.kind === 'size') return access.getSize();
  if (message.kind === 'truncate') {
    access.truncate(message.size);
    access.flush();
    return;
  }
  const { offset, length } = message;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 1 || length > MAX_BLOCK_BYTES) {
    throw new Error('Faixa de vídeo inválida.');
  }
  if (message.kind === 'hash') {
    const bytes = new Uint8Array(length);
    if (access.read(bytes, { at: offset }) !== length) throw new Error('Faixa de vídeo ausente no notebook.');
    return digest(bytes);
  }
  if (message.kind === 'write') {
    const { bytes, sha256 } = message;
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength !== length || await digest(bytes) !== sha256) {
      throw new Error('A integridade de um trecho do vídeo não confere.');
    }
    if (access.write(bytes, { at: offset }) !== length) throw new Error(WRITE_LIMIT);
    access.flush();
    return;
  }
  throw new Error('Operação de vídeo inválida.');
}

let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      self.postMessage({ id: data.id, value: await execute(data) });
    } catch (error) {
      self.postMessage({ id: data.id, error: error?.name === 'QuotaExceededError'
        ? (data.kind === 'probe' ? STORAGE_LIMIT : WRITE_LIMIT)
        : error?.name === 'NoModificationAllowedError'
          ? 'Este vídeo está aberto para gravação em outra aba.'
          : error?.message || 'Armazenamento de vídeo local indisponível.' });
    }
  });
};
