import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeDownloadJob,
  createOrReuseDownloadJob,
  failDownloadJob,
  getDownloadJob,
  listDownloadJobs,
  updateDownloadJob,
} from "@/lib/model-library/download-progress";
import { downloadHuggingFaceGguf } from "@/lib/model-library/model-store";
import { listHuggingFaceGgufFiles } from "@/lib/model-library/huggingface";
import { detectShimmyBinary } from "@/lib/shimmy/binary";
import { configStore } from "@/lib/shimmy/config-store";
import { shimmyProcessManager } from "@/lib/shimmy/process-manager";

export const runtime = "nodejs";

const bodySchema = z.object({
  repoId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  async: z.boolean().optional(),
});

async function restartManagedShimmyIfRunning() {
  if (!shimmyProcessManager.pid) return;
  const config = await configStore.read();
  const detection = await detectShimmyBinary(config);
  if (!detection.selected) return;
  await shimmyProcessManager.stop();
  await shimmyProcessManager.start(detection.selected, config);
}

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { ok: false, error: "Missing Hugging Face repo id or file name" },
      { status: 400 },
    );
  }

  if (body.data.async) {
    const job = createOrReuseDownloadJob(body.data.repoId, body.data.fileName);
    if (!job.reused) {
      void runHuggingFaceDownloadJob(job.jobId, body.data.repoId, body.data.fileName);
    }
    return NextResponse.json({ ok: true, jobId: job.jobId, reused: job.reused }, { status: 202 });
  }

  try {
    const files = await listHuggingFaceGgufFiles(body.data.repoId);
    const selected = files.find((item) => item.name === body.data.fileName);
    if (!selected) {
      return NextResponse.json(
        { ok: false, error: "Selected GGUF file was not found in this repository" },
        { status: 404 },
      );
    }

    const config = await configStore.read();
    const detection = await detectShimmyBinary(config);
    const result = await downloadHuggingFaceGguf({
      repoId: body.data.repoId,
      fileName: selected.name,
      downloadUrl: selected.downloadUrl,
      readConfig: () => configStore.read(),
      writeConfig: (next) => configStore.write(next),
      probeModel: detection.selected
        ? (modelName) => shimmyProcessManager.probe(detection.selected!, modelName)
        : undefined,
    });
    await restartManagedShimmyIfRunning().catch(() => undefined);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Download failed",
      },
      { status: 400 },
    );
  }
}

const statusSchema = z.object({
  jobId: z.string().trim().min(1),
});

const listSchema = z.object({
  list: z.literal("active"),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const listParsed = listSchema.safeParse({
    list: params.get("list"),
  });
  if (listParsed.success) {
    return NextResponse.json({ ok: true, jobs: listDownloadJobs({ includeDone: false }) });
  }
  const parsed = statusSchema.safeParse({
    jobId: params.get("jobId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Missing download job id" }, { status: 400 });
  }
  const snapshot = getDownloadJob(parsed.data.jobId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "Download job not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, job: snapshot });
}

async function runHuggingFaceDownloadJob(jobId: string, repoId: string, fileName: string) {
  try {
    const files = await listHuggingFaceGgufFiles(repoId);
    const selected = files.find((item) => item.name === fileName);
    if (!selected) {
      throw new Error("Selected GGUF file was not found in this repository");
    }
    const config = await configStore.read();
    const detection = await detectShimmyBinary(config);
    await downloadHuggingFaceGguf({
      repoId,
      fileName: selected.name,
      downloadUrl: selected.downloadUrl,
      readConfig: () => configStore.read(),
      writeConfig: (next) => configStore.write(next),
      probeModel: detection.selected
        ? (modelName) => shimmyProcessManager.probe(detection.selected!, modelName)
        : undefined,
      onProgress: (progress) => {
        updateDownloadJob(jobId, {
          phase: progress.phase,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
        });
      },
    });
    await restartManagedShimmyIfRunning().catch(() => undefined);
    completeDownloadJob(jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    failDownloadJob(jobId, message);
  }
}
