#!/usr/bin/env node
const http = require("node:http");

const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log("shimmy 2.0.1 fake");
  process.exit(0);
}

const command = args[0];

if (command === "gpu-info") {
  console.log("Airframe Engine: Enabled (fake WebGPU)");
  process.exit(0);
}

if (command === "probe") {
  const name = args[1] || "unknown";
  console.log(`ok: loaded ${name}`);
  process.exit(0);
}

if (command === "list") {
  console.log("tinyllama-1.1b");
  process.exit(0);
}

if (command === "discover") {
  console.log("Found 1 models: tinyllama-1.1b");
  process.exit(0);
}

if (command === "serve") {
  const bindIndex = args.indexOf("--bind");
  const bind = bindIndex >= 0 ? args[bindIndex + 1] : "127.0.0.1:11435";
  const [host, portText] = bind.split(":");
  const port = Number(portText);
  const server = http.createServer((req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("content-type", "application/json");
    if (req.url === "/health") {
      res.end(
        JSON.stringify({
          status: "ok",
          service: "shimmy",
          version: "2.0.1-fake",
          models: { total: 1, discovered: 1, manual: 0 },
        }),
      );
      return;
    }
    if (req.url === "/metrics") {
      res.end(
        JSON.stringify({
          service: "shimmy",
          gpu_detected: true,
          gpu_vendor: "apple",
          models: { total_count: 1, total_size_mb: 638 },
          system: {
            memory_total_mb: 32768,
            memory_free_mb: 12000,
            memory_available_mb: 18000,
          },
        }),
      );
      return;
    }
    if (req.url === "/api/models" || req.url === "/api/models/discover") {
      res.end(
        JSON.stringify({
          models: [
            {
              name: "tinyllama-1.1b",
              source: "discovered",
              size_bytes: 638000000,
              model_type: "Llama",
              parameter_count: "1.1B",
              quantization: "Q4_0",
            },
          ],
        }),
      );
      return;
    }
    if (req.url === "/v1/chat/completions") {
      res.setHeader("content-type", "text/event-stream");
      res.write(
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      );
      res.write(
        'data: {"choices":[{"delta":{"content":"Hi from fake Shimmy."}}]}\n\n',
      );
      res.end("data: [DONE]\n\n");
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(port, host, () => {
    console.log(`fake shimmy serving on ${bind}`);
  });
  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
  return;
}

console.error(`unknown fake command: ${args.join(" ")}`);
process.exit(1);
