import { inflateRawSync } from 'node:zlib';

const MAX_ENTRIES = 100;
const MAX_TOTAL_UNCOMPRESSED = 50 * 1024 * 1024;
const MAX_SINGLE_FILE = 15 * 1024 * 1024;

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function safeName(name) {
  const normalized = String(name || '').replace(/\\/g, '/');
  const base = normalized.split('/').filter(Boolean).pop() || 'subtitle.srt';
  return base.replace(/[^\p{L}\p{N}._()\- \[\]]/gu, '_').trim() || 'subtitle.srt';
}

export function isZipFile(fileName = '', mimeType = '') {
  return /\.zip$/i.test(String(fileName || '')) || /application\/(zip|x-zip-compressed)/i.test(String(mimeType || ''));
}

export function readSubtitleFilesFromZip(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('ZIP data is not a Buffer.');
  if (buffer.length < 22) throw new Error('ZIP archive is too small.');

  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new Error('Invalid ZIP archive: end-of-central-directory not found.');

  const diskNumber = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error('Multi-disk ZIP archives are not supported.');
  }
  if (totalEntries > MAX_ENTRIES) throw new Error(`ZIP contains too many entries (max ${MAX_ENTRIES}).`);
  if (centralOffset + centralSize > buffer.length) throw new Error('Invalid ZIP central directory.');

  const results = [];
  let cursor = centralOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < totalEntries; i += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory entry.');
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;

    if (nameEnd + extraLength + commentLength > buffer.length) {
      throw new Error('Invalid ZIP entry boundaries.');
    }

    const rawName = buffer.subarray(nameStart, nameEnd);
    const fileName = rawName.toString(flags & 0x800 ? 'utf8' : 'utf8');
    const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';

    // Only subtitle files are extracted; directories and other files are ignored.
    if (['srt', 'ass', 'ssa', 'vtt'].includes(ext)) {
      if (flags & 0x1) throw new Error(`Encrypted ZIP entry is not supported: ${fileName}`);
      if (compressedSize > buffer.length || uncompressedSize > MAX_SINGLE_FILE) {
        throw new Error(`ZIP entry is too large: ${fileName}`);
      }
      if (totalUncompressed + uncompressedSize > MAX_TOTAL_UNCOMPRESSED) {
        throw new Error('ZIP subtitle content exceeds the safety size limit.');
      }

      if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error(`Invalid local header: ${fileName}`);
      }

      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) throw new Error(`Invalid compressed data range: ${fileName}`);

      const compressed = buffer.subarray(dataStart, dataEnd);
      let data;
      if (method === 0) {
        data = Buffer.from(compressed);
      } else if (method === 8) {
        data = inflateRawSync(compressed);
      } else {
        throw new Error(`Unsupported ZIP compression method ${method}: ${fileName}`);
      }

      if (data.length !== uncompressedSize) {
        throw new Error(`ZIP size mismatch: ${fileName}`);
      }

      totalUncompressed += data.length;
      results.push({
        fileName: safeName(fileName),
        originalPath: fileName,
        data
      });
    }

    cursor = nameEnd + extraLength + commentLength;
  }

  return results;
}
