import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BinaryCandidate, ShimmyUiConfig } from "./types";

const execFileAsync = promisify(execFile);
const versionProbeTimeoutMs = 5_000;

async function isExecutable(filePath: string) {
  try {
    await access(filePath, os.platform() === "win32" ? undefined : constants.X_OK);
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function candidate(pathValue: string, source: BinaryCandidate["source"]) {
  const exists = await stat(pathValue)
    .then((info) => info.isFile())
    .catch(() => false);
  const executable = exists ? await isExecutable(pathValue) : false;
  const result: BinaryCandidate = {
    path: pathValue,
    exists,
    executable,
    source,
  };

  if (executable) {
    try {
      const { stdout, stderr } = await execFileAsync(pathValue, ["--version"], {
        timeout: versionProbeTimeoutMs,
      });
      result.version = (stdout || stderr).trim();
    } catch {
      result.version = undefined;
    }
  }

  return result;
}

function pathCandidates() {
  const entries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((dir) =>
      os.platform() === "win32"
        ? [path.join(dir, "shimmy.exe"), path.join(dir, "shimmy")]
        : [path.join(dir, "shimmy")],
    );
  return Array.from(new Set(entries));
}

export async function detectShimmyBinary(
  config: ShimmyUiConfig,
  cwd = process.env.SHIMMY_UI_PROJECT_ROOT ?? process.cwd(),
  homeDir = os.homedir(),
) {
  const configured = config.shimmyPath
    ? [await candidate(config.shimmyPath, "configured")]
    : [];
  const pathBased = await Promise.all(
    pathCandidates().map((item) => candidate(item, "path")),
  );
  const projectBased = await Promise.all(
    ["shimmy", "shimmy.exe"].map((item) =>
      candidate(path.join(/* turbopackIgnore: true */ cwd, item), "project"),
    ),
  );
  const homeBased = await Promise.all(
    ["shimmy", "shimmy.exe"].map((item) =>
      candidate(path.join(homeDir, "bin", item), "home"),
    ),
  );
  const candidates = [...configured, ...pathBased, ...projectBased, ...homeBased];
  return {
    selected: candidates.find((item) => item.executable) ?? null,
    candidates,
  };
}
