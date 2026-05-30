import { access, readdir, stat } from "node:fs/promises";
import type { ModelDirectoriesHealth, ModelDirectoryStatus } from "./types";

const MAX_SCAN_DEPTH = 3;
const MAX_SCAN_ENTRIES = 2_000;
const MAX_SAMPLE_FILES = 5;

export async function inspectModelDirectories(
  modelDirs: string[],
): Promise<ModelDirectoriesHealth> {
  const directories = await Promise.all(modelDirs.map(inspectModelDirectory));
  const totalGgufFiles = directories.reduce((sum, item) => sum + item.ggufFiles, 0);

  return {
    configured: modelDirs.length > 0,
    directories,
    totalGgufFiles,
    hasReadableDirectory: directories.some((item) => item.readable),
    hasModels: totalGgufFiles > 0,
  };
}

async function inspectModelDirectory(dirPath: string): Promise<ModelDirectoryStatus> {
  try {
    const info = await stat(dirPath);
    if (!info.isDirectory()) {
      return {
        path: dirPath,
        exists: true,
        readable: false,
        ggufFiles: 0,
        sampleFiles: [],
        error: "Path is not a directory",
      };
    }
    await access(dirPath);
    const scan = await scanForGguf(dirPath);
    return {
      path: dirPath,
      exists: true,
      readable: true,
      ggufFiles: scan.count,
      sampleFiles: scan.samples,
      error: scan.truncated ? "Scan stopped after reaching the safety limit" : undefined,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      path: dirPath,
      exists: code !== "ENOENT",
      readable: false,
      ggufFiles: 0,
      sampleFiles: [],
      error: error instanceof Error ? error.message : "Unable to read directory",
    };
  }
}

async function scanForGguf(root: string) {
  let visited = 0;
  let count = 0;
  let truncated = false;
  const samples: string[] = [];

  async function visit(currentPath: string, depth: number): Promise<void> {
    if (visited >= MAX_SCAN_ENTRIES) {
      truncated = true;
      return;
    }
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (visited >= MAX_SCAN_ENTRIES) {
        truncated = true;
        return;
      }
      visited += 1;
      const entryPath = `${currentPath}/${entry.name}`;
      if (entry.isDirectory() && depth < MAX_SCAN_DEPTH) {
        await visit(entryPath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".gguf")) {
        count += 1;
        if (samples.length < MAX_SAMPLE_FILES) {
          samples.push(entryPath);
        }
      }
    }
  }

  await visit(root, 0);
  return { count, samples, truncated };
}
