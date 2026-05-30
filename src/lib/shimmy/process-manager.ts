import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { buildProbeCommand, buildServeCommand } from "./commands";
import { configStore } from "./config-store";
import { LogBuffer } from "./log-buffer";
import type { BinaryCandidate, ServiceState, ShimmyUiConfig } from "./types";

export class ShimmyProcessManager {
  private child: ChildProcessWithoutNullStreams | null = null;
  private state: ServiceState = "stopped";
  private lastError: string | null = null;
  readonly logs = new LogBuffer(700);

  get pid() {
    return this.child?.pid;
  }

  status(binary: BinaryCandidate | null, externalHealthy: boolean): ServiceState {
    if (!binary) {
      return "missing-binary";
    }
    if (this.child && this.state !== "error") {
      return this.state === "starting" ? "starting" : "running-managed";
    }
    if (externalHealthy) {
      return "running-external";
    }
    if (this.lastError) {
      return "error";
    }
    return "stopped";
  }

  async start(binary: BinaryCandidate, config: ShimmyUiConfig) {
    if (this.child) {
      return { state: "running-managed" as const, pid: this.child.pid };
    }
    if (!binary.executable) {
      throw new Error("Shimmy binary is not executable");
    }

    const command = buildServeCommand(binary.path, config);
    this.state = "starting";
    this.lastError = null;
    this.logs.push("system", `Starting ${command.command} ${command.args.join(" ")}`);

    const child = spawn(command.command, command.args, {
      env: { ...process.env, ...command.env },
      shell: false,
      stdio: "pipe",
    });
    this.child = child;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      this.state = "running-managed";
      String(chunk)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.logs.push("stdout", line));
    });
    child.stderr.on("data", (chunk) => {
      String(chunk)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.logs.push("stderr", line));
    });
    child.on("spawn", () => {
      this.state = "running-managed";
      this.logs.push("system", `Shimmy process spawned with pid ${child.pid ?? "unknown"}`);
    });
    child.on("error", (error) => {
      this.state = "error";
      this.lastError = error.message;
      this.logs.push("stderr", error.message);
      this.child = null;
    });
    child.on("exit", (code, signal) => {
      this.logs.push("system", `Shimmy exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
      this.child = null;
      this.state = this.lastError ? "error" : "stopped";
    });

    return { state: this.state, pid: child.pid };
  }

  async stop() {
    if (!this.child) {
      this.logs.push("system", "No managed shimmy process to stop");
      return { stopped: false };
    }
    const child = this.child;
    this.logs.push("system", `Stopping managed shimmy process ${child.pid ?? "unknown"}`);
    child.kill("SIGTERM");
    this.child = null;
    this.state = "stopped";
    return { stopped: true };
  }

  async probe(binary: BinaryCandidate, modelName: string) {
    const config = await configStore.read();
    const command = buildProbeCommand(binary.path, modelName);
    const env = {
      ...process.env,
      ...(config.modelDirs.length > 0
        ? { SHIMMY_MODEL_PATHS: config.modelDirs.join(";") }
        : {}),
      ...(config.baseGguf ? { SHIMMY_BASE_GGUF: config.baseGguf } : {}),
      ...(config.maxCtx ? { SHIMMY_MAX_CTX: String(config.maxCtx) } : {}),
    };
    return new Promise<{ ok: boolean; output: string }>((resolve) => {
      const child = spawn(command.command, command.args, {
        env,
        shell: false,
        stdio: "pipe",
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        output += String(chunk);
      });
      child.on("error", (error) => {
        resolve({ ok: false, output: error.message });
      });
      child.on("exit", (code) => {
        resolve({ ok: code === 0, output: output.trim() });
      });
    });
  }
}

const globalForShimmy = globalThis as typeof globalThis & {
  __shimmyUiProcessManager?: ShimmyProcessManager;
};

export const shimmyProcessManager =
  globalForShimmy.__shimmyUiProcessManager ?? new ShimmyProcessManager();

globalForShimmy.__shimmyUiProcessManager = shimmyProcessManager;
