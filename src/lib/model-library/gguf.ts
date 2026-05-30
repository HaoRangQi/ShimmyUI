import { open, stat } from "node:fs/promises";
import type { GgufMetadata } from "./types";

const ggufMagic = "GGUF";

export function isGgufBuffer(buffer: Buffer | Uint8Array) {
  if (buffer.length < 4) return false;
  return Buffer.from(buffer.subarray(0, 4)).toString("ascii") === ggufMagic;
}

export async function readGgufMetadata(filePath: string): Promise<GgufMetadata> {
  const info = await stat(filePath);
  const file = await open(filePath, "r");
  const header = Buffer.alloc(8);
  let bytesRead = 0;
  try {
    const read = await file.read(header, 0, header.length, 0);
    bytesRead = read.bytesRead;
  } finally {
    await file.close();
  }
  if (!isGgufBuffer(header.subarray(0, bytesRead))) {
    return { path: filePath, valid: false, sizeBytes: info.size };
  }
  const version = bytesRead >= 8 ? header.readUInt32LE(4) : undefined;
  return {
    path: filePath,
    valid: true,
    version,
    sizeBytes: info.size,
  };
}
