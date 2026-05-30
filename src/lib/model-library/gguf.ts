import { stat, readFile } from "node:fs/promises";
import type { GgufMetadata } from "./types";

const ggufMagic = "GGUF";

export function isGgufBuffer(buffer: Buffer | Uint8Array) {
  if (buffer.length < 4) return false;
  return Buffer.from(buffer.subarray(0, 4)).toString("ascii") === ggufMagic;
}

export async function readGgufMetadata(filePath: string): Promise<GgufMetadata> {
  const [info, handle] = await Promise.all([
    stat(filePath),
    readFile(filePath),
  ]);
  if (!isGgufBuffer(handle)) {
    return { path: filePath, valid: false, sizeBytes: info.size };
  }
  const version = handle.length >= 8 ? handle.readUInt32LE(4) : undefined;
  return {
    path: filePath,
    valid: true,
    version,
    sizeBytes: info.size,
  };
}
