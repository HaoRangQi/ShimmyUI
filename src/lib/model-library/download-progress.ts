import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelDownloadPhase } from "./model-store";

export interface ModelDownloadSnapshot {
  jobId: string;
  phase: ModelDownloadPhase;
  downloadedBytes: number;
  totalBytes?: number;
  startedAt: string;
  updatedAt: string;
  done: boolean;
  error?: string;
}

type DownloadJobState = {
  repoId: string;
  fileName: string;
  startedAt: string;
  updatedAt: string;
  done: boolean;
  phase: ModelDownloadPhase;
  downloadedBytes: number;
  totalBytes?: number;
  error?: string;
};

type DownloadJobLockState = {
  jobId: string;
  repoId: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
};

export type DownloadJobRecord = {
  jobId: string;
  repoId: string;
  fileName: string;
  job: ModelDownloadSnapshot;
};

const doneRetentionMs = 10 * 60_000;
const staleActiveMs = 5 * 60_000;
const maxJobs = 200;

function nowIso() {
  return new Date().toISOString();
}

function defaultShimmyUiHome() {
  return process.env.SHIMMY_UI_HOME || path.join(os.homedir(), ".shimmy-ui");
}

function jobsDir() {
  return path.join(defaultShimmyUiHome(), "download-jobs");
}

function jobLocksDir() {
  return path.join(defaultShimmyUiHome(), "download-job-locks");
}

function ensureJobsDir() {
  mkdirSync(jobsDir(), { recursive: true });
}

function ensureJobLocksDir() {
  mkdirSync(jobLocksDir(), { recursive: true });
}

function jobFilePath(jobId: string) {
  return path.join(jobsDir(), `${jobId}.json`);
}

function jobLockPath(repoId: string, fileName: string) {
  const key = createHash("sha256")
    .update(`${repoId}\n${fileName}`)
    .digest("hex");
  return path.join(jobLocksDir(), `${key}.json`);
}

function safeReadJob(jobId: string): DownloadJobState | null {
  try {
    return JSON.parse(readFileSync(jobFilePath(jobId), "utf8")) as DownloadJobState;
  } catch {
    return null;
  }
}

function safeReadJobLock(lockPath: string): DownloadJobLockState | null {
  try {
    return JSON.parse(readFileSync(lockPath, "utf8")) as DownloadJobLockState;
  } catch {
    return null;
  }
}

function safeWriteJob(jobId: string, job: DownloadJobState) {
  ensureJobsDir();
  const target = jobFilePath(jobId);
  const temp = `${target}.tmp`;
  writeFileSync(temp, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  renameSync(temp, target);
}

function safeWriteJobLock(lockPath: string, lock: DownloadJobLockState) {
  ensureJobLocksDir();
  const temp = `${lockPath}.tmp`;
  writeFileSync(temp, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  renameSync(temp, lockPath);
}

function removeFileIfPresent(filePath: string) {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function removeJobLockIfOwned(repoId: string, fileName: string, jobId?: string) {
  const lockPath = jobLockPath(repoId, fileName);
  const lock = safeReadJobLock(lockPath);
  if (!lock) {
    removeFileIfPresent(lockPath);
    return;
  }
  if (jobId && lock.jobId !== jobId) return;
  removeFileIfPresent(lockPath);
}

function findActiveJobByModel(repoId: string, fileName: string): DownloadJobRecord | null {
  const jobs = listDownloadJobs({ includeDone: false });
  return jobs.find((item) => item.repoId === repoId && item.fileName === fileName) ?? null;
}

function toSnapshot(jobId: string, state: DownloadJobState): ModelDownloadSnapshot {
  return {
    jobId,
    phase: state.phase,
    downloadedBytes: state.downloadedBytes,
    totalBytes: state.totalBytes,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    done: state.done,
    error: state.error,
  };
}

function cleanupJobs() {
  ensureJobsDir();
  const now = Date.now();
  const files = readdirSync(jobsDir()).filter((name) => name.endsWith(".json"));

  for (const file of files) {
    const jobId = file.replace(/\.json$/, "");
    const state = safeReadJob(jobId);
    if (!state) {
      unlinkSync(path.join(jobsDir(), file));
      continue;
    }
    const updatedAtMs = Date.parse(state.updatedAt);
    const ageMs = Number.isFinite(updatedAtMs) ? now - updatedAtMs : 0;

    if (!state.done && ageMs > staleActiveMs) {
      state.done = true;
      state.error = "Download task interrupted or worker restarted";
      state.updatedAt = nowIso();
      safeWriteJob(jobId, state);
      continue;
    }

    if (state.done && ageMs > doneRetentionMs) {
      unlinkSync(path.join(jobsDir(), file));
    }
  }

  const current = readdirSync(jobsDir())
    .filter((name) => name.endsWith(".json"))
    .map((file) => ({
      file,
      updatedAtMs: statSync(path.join(jobsDir(), file)).mtimeMs,
    }))
    .sort((left, right) => left.updatedAtMs - right.updatedAtMs);
  while (current.length > maxJobs) {
    const oldest = current.shift();
    if (!oldest) break;
    unlinkSync(path.join(jobsDir(), oldest.file));
  }
}

export function createDownloadJob(repoId: string, fileName: string) {
  cleanupJobs();
  const jobId = randomUUID();
  const startedAt = nowIso();
  const state: DownloadJobState = {
    repoId,
    fileName,
    startedAt,
    updatedAt: startedAt,
    done: false,
    phase: "downloading",
    downloadedBytes: 0,
  };
  safeWriteJob(jobId, state);
  return { jobId, snapshot: toSnapshot(jobId, state) };
}

export function createOrReuseDownloadJob(repoId: string, fileName: string) {
  const normalizedRepoId = repoId.trim();
  const normalizedFileName = fileName.trim();
  cleanupJobs();
  ensureJobLocksDir();
  const lockPath = jobLockPath(normalizedRepoId, normalizedFileName);
  const now = nowIso();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = findActiveJobByModel(normalizedRepoId, normalizedFileName);
    if (existing) {
      safeWriteJobLock(lockPath, {
        jobId: existing.jobId,
        repoId: normalizedRepoId,
        fileName: normalizedFileName,
        createdAt: existing.job.startedAt,
        updatedAt: now,
      });
      return {
        jobId: existing.jobId,
        snapshot: existing.job,
        reused: true,
      } as const;
    }

    const candidateId = randomUUID();
    try {
      writeFileSync(
        lockPath,
        `${JSON.stringify(
          {
            jobId: candidateId,
            repoId: normalizedRepoId,
            fileName: normalizedFileName,
            createdAt: now,
            updatedAt: now,
          } satisfies DownloadJobLockState,
          null,
          2,
        )}\n`,
        { encoding: "utf8", flag: "wx" },
      );

      const startedAt = nowIso();
      const state: DownloadJobState = {
        repoId: normalizedRepoId,
        fileName: normalizedFileName,
        startedAt,
        updatedAt: startedAt,
        done: false,
        phase: "downloading",
        downloadedBytes: 0,
      };
      safeWriteJob(candidateId, state);
      safeWriteJobLock(lockPath, {
        jobId: candidateId,
        repoId: normalizedRepoId,
        fileName: normalizedFileName,
        createdAt: startedAt,
        updatedAt: startedAt,
      });
      return {
        jobId: candidateId,
        snapshot: toSnapshot(candidateId, state),
        reused: false,
      } as const;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      const lock = safeReadJobLock(lockPath);
      if (!lock) {
        removeFileIfPresent(lockPath);
        continue;
      }
      if (lock.repoId !== normalizedRepoId || lock.fileName !== normalizedFileName) {
        removeFileIfPresent(lockPath);
        continue;
      }
      const lockedJobState = safeReadJob(lock.jobId);
      if (lockedJobState && !lockedJobState.done) {
        return {
          jobId: lock.jobId,
          snapshot: toSnapshot(lock.jobId, lockedJobState),
          reused: true,
        } as const;
      }
      removeFileIfPresent(lockPath);
    }
  }

  const fallback = findActiveJobByModel(normalizedRepoId, normalizedFileName);
  if (fallback) {
    return {
      jobId: fallback.jobId,
      snapshot: fallback.job,
      reused: true,
    } as const;
  }
  throw new Error("Unable to acquire download lock for this model");
}

export function updateDownloadJob(
  jobId: string,
  update: { phase?: ModelDownloadPhase; downloadedBytes?: number; totalBytes?: number },
) {
  const job = safeReadJob(jobId);
  if (!job) return;
  if (update.phase) job.phase = update.phase;
  if (typeof update.downloadedBytes === "number") job.downloadedBytes = update.downloadedBytes;
  if (typeof update.totalBytes === "number") job.totalBytes = update.totalBytes;
  job.updatedAt = nowIso();
  safeWriteJob(jobId, job);
}

export function completeDownloadJob(jobId: string) {
  const job = safeReadJob(jobId);
  if (!job) return;
  job.done = true;
  job.phase = "done";
  job.updatedAt = nowIso();
  safeWriteJob(jobId, job);
  removeJobLockIfOwned(job.repoId, job.fileName, jobId);
}

export function failDownloadJob(jobId: string, error: string) {
  const job = safeReadJob(jobId);
  if (!job) return;
  job.done = true;
  job.error = error;
  job.updatedAt = nowIso();
  safeWriteJob(jobId, job);
  removeJobLockIfOwned(job.repoId, job.fileName, jobId);
}

export function getDownloadJob(jobId: string): ModelDownloadSnapshot | null {
  cleanupJobs();
  const job = safeReadJob(jobId);
  if (!job) return null;
  return toSnapshot(jobId, job);
}

export function listDownloadJobs({ includeDone = true }: { includeDone?: boolean } = {}) {
  cleanupJobs();
  ensureJobsDir();
  return readdirSync(jobsDir())
    .filter((name) => name.endsWith(".json"))
    .map((file) => {
      const jobId = file.replace(/\.json$/, "");
      const state = safeReadJob(jobId);
      if (!state) return null;
      return {
        jobId,
        repoId: state.repoId,
        fileName: state.fileName,
        job: toSnapshot(jobId, state),
      };
    })
    .filter((item): item is DownloadJobRecord => Boolean(item))
    .filter((item) => includeDone || !item.job.done)
    .map((item) => ({
      jobId: item.jobId,
      repoId: item.repoId,
      fileName: item.fileName,
      job: item.job,
    }));
}
