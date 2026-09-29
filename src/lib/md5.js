import SparkMD5 from "spark-md5";

const MIB = 1024 * 1024;
const TARGET_PART_BYTES = 8 * MIB;
const MIN_MULTI_PART_BYTES = 4 * MIB;

export function calculateParts(fileSize) {
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) throw new Error("Arquivo vazio ou inválido.");

  let count = Math.max(1, Math.ceil(size / TARGET_PART_BYTES));
  while (count > 1 && Math.floor(size / count) <= MIN_MULTI_PART_BYTES) {
    count -= 1;
  }

  const base = Math.floor(size / count);
  let remainder = size % count;
  const parts = [];
  let start = 0;

  for (let i = 0; i < count; i += 1) {
    const partSize = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    const end = start + partSize;
    parts.push({ index: i, start, end, size: partSize });
    start = end;
  }

  if (parts.length > 1 && parts.some(part => part.size <= MIN_MULTI_PART_BYTES)) {
    return [{ index: 0, start: 0, end: size, size }];
  }

  return parts;
}

export async function hashFileParts(file, parts, onProgress = () => {}) {
  const hashes = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const buffer = await file.slice(part.start, part.end).arrayBuffer();
    const hash = SparkMD5.ArrayBuffer.hash(buffer);
    hashes.push(hash);
    onProgress((i + 1) / parts.length);
  }
  return hashes;
}
