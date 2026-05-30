# Shimmy UI Docker/Linux 落地报告（2026-05-30）

## 1. 目标与范围

本次落地目标：将 Shimmy UI 交付为可在 Linux 服务器使用的 Docker 方案，同时补齐登录鉴权与 Ollama 下载兼容控制，降低部署和模型管理门槛。

范围包含：

- Docker 镜像与 Compose 部署。
- 登录页 + 会话鉴权（环境变量账号密码）。
- Ollama 外部服务接入与模型下载兼容性校验。
- 文档、测试与构建验证。

## 2. 已落地内容

### 2.1 Docker 与 Linux 服务器化

- 启用 Next standalone 输出（`output: "standalone"`）。
- 新增多阶段构建 `Dockerfile`，镜像内仅包含 UI 运行所需产物。
- 新增 `.dockerignore`，降低镜像上下文与构建开销。
- 新增 `docker-compose.yml`，默认映射 UI 端口 `37645`。
- 容器数据目录统一为 `/data`：
  - `SHIMMY_UI_HOME=/data`
  - `SHIMMY_UI_CONFIG_PATH=/data/config.json`
  - `SHIMMY_UI_RUNTIME_PATH=/data/runtime.json`

### 2.2 登录鉴权（服务器场景）

- 新增登录页：`/login`。
- 新增接口：
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
- 新增全局访问保护（`src/proxy.ts`）：
  - 页面未登录跳转 `/login`。
  - 受保护 API 未登录返回 `401`。
  - 生产模式缺少账号密码时返回配置错误（`503`/登录页提示）。
- 会话采用 HttpOnly Cookie，支持 TTL 与签名密钥配置。

### 2.3 模型下载通道与兼容策略

渠道 1：Ollama 下载（自动校验）

- 支持 `SHIMMY_UI_OLLAMA_BASE_URL` 指向外部 Ollama。
- `pull` 完成后自动调用 `show` 校验。
- 仅接受 `GGUF + completion` 模型；不兼容模型自动删除，避免污染模型库。

渠道 2：Shimmy 兼容 GGUF 目录下载

- 保持现有 curated catalog 流程：
  - 仅允许通过 checksum + 兼容标记的 GGUF 模型下载并注册。

## 3. 关键文件变更

- 配置与容器
  - `/Users/macos/Downloads/Projects/shimmyUI/next.config.mjs`
  - `/Users/macos/Downloads/Projects/shimmyUI/Dockerfile`
  - `/Users/macos/Downloads/Projects/shimmyUI/.dockerignore`
  - `/Users/macos/Downloads/Projects/shimmyUI/docker-compose.yml`
- 鉴权
  - `/Users/macos/Downloads/Projects/shimmyUI/src/lib/auth/session.ts`
  - `/Users/macos/Downloads/Projects/shimmyUI/src/proxy.ts`
  - `/Users/macos/Downloads/Projects/shimmyUI/src/app/login/page.tsx`
  - `/Users/macos/Downloads/Projects/shimmyUI/src/app/api/auth/login/route.ts`
  - `/Users/macos/Downloads/Projects/shimmyUI/src/app/api/auth/logout/route.ts`
  - `/Users/macos/Downloads/Projects/shimmyUI/src/app/api/auth/session/route.ts`
- Ollama
  - `/Users/macos/Downloads/Projects/shimmyUI/src/lib/model-library/ollama.ts`
- 文案与文档
  - `/Users/macos/Downloads/Projects/shimmyUI/src/lib/i18n.ts`
  - `/Users/macos/Downloads/Projects/shimmyUI/README.md`
- 测试
  - `/Users/macos/Downloads/Projects/shimmyUI/src/lib/auth/session.test.ts`
  - `/Users/macos/Downloads/Projects/shimmyUI/src/app/api/auth/auth-routes.test.ts`
  - `/Users/macos/Downloads/Projects/shimmyUI/src/lib/model-library/model-library.test.ts`

## 4. 验证结果

已执行并通过：

- `npm run lint`
- `npm run typecheck`
- `npm run test`（83 tests）
- `npm run build`
- `docker build -t shimmy-ui:local .`

运行态验证通过：

- 未登录访问 `/` 被 `307` 跳转到 `/login`。
- 未登录访问受保护 API 返回 `401`。
- 登录成功后可获得会话并访问受保护接口。

说明：`npm run test:e2e` 本次未执行。

## 5. 当前演示实例

当前本机正在运行预览容器：

- 名称：`shimmy-ui-preview`
- 访问地址：`http://127.0.0.1:47831`
- 端口映射：`47831 -> 37645`

## 6. 上线与回滚建议

上线建议：

1. 在 Linux 服务器使用 `docker compose up -d --build`。
2. 强制设置：
   - `SHIMMY_UI_USERNAME`
   - `SHIMMY_UI_PASSWORD`
3. 按部署模式设置 Ollama 地址：
   - 宿主机 Ollama：`http://host.docker.internal:11434`（Linux 需 host-gateway）
   - 独立 Ollama 服务：`http://ollama:11434`
4. 仅暴露 UI 端口，Shimmy API 端口按需映射。

回滚建议：

1. 保留 `/data` volume 不删除（避免配置/模型丢失）。
2. 回退到上一版镜像 tag 并重启容器。
3. 若鉴权策略需临时降级，仅在内网受控环境下执行，并记录变更窗口。
