// Uncompressed ZIP; video streams are already compressed. No media sent to a server.
export async function videoArchive(files: {
    name: string;
    blob: Blob;
}[], options: { signal?: AbortSignal; onProgress?: (value: number) => void } = {}): Promise<Blob> {
    const parts: BlobPart[] = [], directory: BlobPart[] = [];
    options.signal?.throwIfAborted();
    let offset = 0, directoryLength = 0;
    const total = files.reduce((size, file) => size + file.blob.size, 0);
    // ZIP32 only. Reject before reading a large file instead of allocating it first.
    if (files.length > 65535 || total + files.reduce((size, file) => size + 76 + new TextEncoder().encode(file.name).length * 2, 22) > 0xffffffff)
        throw new Error('O pacote excede 4 GB. Exporte menos rallies por vez.');
    let completed = 0;
    const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++)
        n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
    for (const file of files) {
        const name = new TextEncoder().encode(file.name);
        if (name.length > 65535 || /(^|[\\/])\.\.([\\/]|$)|^[\\/]/.test(file.name)) throw new Error('Nome de arquivo inválido.');
        let crc = 0xffffffff;
        // Keep at most 2 MB of media in JS memory and yield between chunks.
        for (let start = 0; start < file.blob.size; start += 2 * 1024 * 1024) {
            options.signal?.throwIfAborted();
            const bytes = new Uint8Array(await file.blob.slice(start, start + 2 * 1024 * 1024).arrayBuffer());
            options.signal?.throwIfAborted();
            for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
            completed += bytes.length;
            options.onProgress?.(completed / Math.max(1, total));
        }
        options.signal?.throwIfAborted();
        crc = (crc ^ 0xffffffff) >>> 0;
        const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
        h.setUint32(0, 0x04034b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 0x800, true);
        h.setUint32(14, crc, true);
        h.setUint32(18, file.blob.size, true);
        h.setUint32(22, file.blob.size, true);
        h.setUint16(26, name.length, true);
        header.set(name, 30);
        const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
        c.setUint32(0, 0x02014b50, true);
        c.setUint16(4, 20, true);
        c.setUint16(6, 20, true);
        c.setUint16(8, 0x800, true);
        c.setUint32(16, crc, true);
        c.setUint32(20, file.blob.size, true);
        c.setUint32(24, file.blob.size, true);
        c.setUint16(28, name.length, true);
        c.setUint32(42, offset, true);
        central.set(name, 46);
        parts.push(header, file.blob);
        directory.push(central);
        directoryLength += central.length;
        offset += header.length + file.blob.size;
        if (offset + directoryLength > 0xffffffff)
            throw new Error('Selecione menos rallies por download.');
    }
    const footer = new Uint8Array(22), end = new DataView(footer.buffer);
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, directoryLength, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, footer], { type: 'application/zip' });
}
