# Shimmy UI 二期优化规划

## 1. 背景

Shimmy UI 当前已经完成本地管理控制台的 MVP：可以探测 Shimmy、管理 UI 托管的 runtime、启动/停止服务、查看模型、运行聊天、读取日志，并提供中文优先的 Material You 风格界面。

二期目标不是继续堆功能，而是把它从“可用的开发者原型”推进到“可信赖的本地 Shimmy Runtime Control Plane”。核心标准是：新用户能顺利完成首次启动，重度用户能稳定运维，工程实现能长期维护。

## 2. 二期目标

1. 降低首次使用门槛：用任务式向导串起安装、配置、发现模型、启动、试聊。
2. 提升运行时操作可信度：所有下载、安装、更新、卸载、回滚都有进度、结果、错误解释和确认边界。
3. 强化诊断能力：把端口、binary、模型目录、GitHub Release、服务健康、日志错误整合成可执行的排障建议。
4. 收敛工程架构：减少 Next 管理层和 fallback 管理层的重复逻辑，降低维护成本。
5. 完善 Material You 体验：补齐 toast、dialog、progress、移动端导航、可访问性和设计 token 规范。

## 3. 非目标

二期仍保持本地优先，不引入账号系统、远程部署、多租户权限、模型下载器、无人值守自动更新、多实例编排和云端同步。模型下载和远程集群管理可以进入后续版本评估。

## 4. 四类视角审视结论

### 4.1 重度用户视角

当前痛点：

- 首次打开后只有“未找到 Shimmy”和提示，用户仍需要自己理解 Runtime、Config、Models 的关系。
- Runtime 操作缺少强反馈：没有下载进度、安装进度、成功 toast、失败原因翻译和失败后的下一步建议。
- 卸载和回滚是高风险操作，但缺少确认弹窗、影响说明和恢复路径说明。
- Chat 只适合 smoke test，缺少会话历史、停止生成、复制响应、参数 preset 和错误恢复。
- Logs 能显示输出，但缺少错误高亮、自动滚动、导出、按 stream/关键词过滤、最近失败入口。

用户期待：

- UI 帮我判断 Shimmy 是否安装、是否可运行、模型目录是否有效。
- 点一个按钮能走完“安装 Shimmy → 选择模型目录 → 发现模型 → 启动服务 → 发一次测试消息”。
- 出错时不要只显示 HTTP 502 或 command failed，要告诉我是端口冲突、没有模型、权限、网络、checksum，还是 binary 不可执行。

### 4.2 高级产品经理视角

产品定位：

Shimmy UI 应定位为“本地 Shimmy Runtime Control Plane”，而不是普通聊天客户端。Chat 是验证能力，核心价值是本地 runtime 生命周期、模型发现和诊断运维。

产品结构问题：

- 当前导航是功能模块并列：Overview、Models、Chat、Runtime、Config、Logs。对熟练用户可以，但新用户缺少任务路径。
- Runtime 和 Config 分离合理，但首次用户需要向导覆盖二者。
- Overview 现在更像指标页，二期应变成任务式状态页：当前阻塞、下一步动作、诊断摘要。
- Models 缺少“模型目录是否可读、扫描结果、默认模型状态、probe 结果”的闭环。

建议产品指标：

- 首次成功启动耗时。
- Runtime 安装成功率。
- 模型发现成功率。
- Chat 首次响应成功率。
- 启动失败原因分布。
- 回滚/卸载误操作率。

### 4.3 高级全栈工程师视角

当前优势：

- 启动 Shimmy 使用参数数组和 `shell:false`。
- Runtime 安装范围限制在 `~/.shimmy-ui/bin`。
- 下载和回滚已经有 sha256 校验。
- 外部已运行 Shimmy 只显示 connected，不强杀。
- E2E 已覆盖 fake Shimmy 生命周期。

主要工程风险：

- Next 管理层和 zero-dependency fallback 后端存在重复逻辑，长期会产生行为分叉。
- `globalThis` 单例适合本地 Node dev，但对多进程、热重载和更复杂部署不是稳定状态源。
- Runtime 下载、安装、更新、回滚还缺少跨请求互斥锁，连续点击可能产生竞态。
- GitHub Release 请求没有缓存、超时和 rate limit 用户反馈。
- Chat proxy 缺少请求体大小限制、超时控制和取消控制。
- `theme: "system"` 当前语义不完整，实际还没有按系统主题切换。
- `npm audit --audit-level=high` 仍报告 Next、glob、Vite/esbuild 依赖链风险，修复需要升级评估。

### 4.4 UI 工程师视角

当前优势：

- 已切换到 Material You 风格的 tonal surface、rounded shape、navigation rail、filled/tonal buttons。
- 中文默认、英文切换、桌面和移动 Runtime 页面没有横向溢出。

主要问题：

- 中文表单 label 被 uppercase 后出现 `SHIMMY 路径`、`GPU BACKEND`，中文语境不自然。
- 移动端仍是侧栏堆叠，不是更适合移动端的 bottom navigation 或 navigation drawer。
- Runtime 的 checksum、path 信息过长，应折叠、截断或提供复制按钮。
- 缺少 Material 关键交互组件：toast、dialog、linear progress、snackbar、modal sheet。
- 卸载按钮和普通按钮在同一区域，危险操作视觉隔离不够。
- 可访问性还不完整：focus ring、aria-live、按钮 pending 文案、错误区域语义需要补齐。

## 5. 二期优先级

### P0：可信操作闭环

| 项目 | 目标 | 验收标准 |
| --- | --- | --- |
| Runtime 操作互斥锁 | 防止下载、安装、更新、回滚并发执行 | 连续点击不会产生重复写入或 metadata 错乱 |
| Toast/Snackbar | 所有关键操作有成功、失败、进行中反馈 | Runtime、Start、Stop、Save、Discover、Chat 都有结果反馈 |
| Progress | 下载和安装显示进行中状态 | 按钮 pending、页面进度条、操作不可重复触发 |
| Confirm dialog | 卸载和回滚必须二次确认 | 用户能看到影响范围和取消路径 |
| 错误翻译和下一步 | 常见错误给出可执行建议 | 端口冲突、无 binary、网络失败、checksum 失败、模型为空都有中文说明 |
| system theme 修复 | `system` 主题真实跟随系统 | 切换系统深浅色后 UI 自动更新 |
| 依赖安全评估 | 处理 high 级 audit 风险 | 形成升级方案并验证 lint/test/build/e2e |

### P1：首次成功体验

| 项目 | 目标 | 验收标准 |
| --- | --- | --- |
| Setup 向导 | 串起安装、配置、发现、启动、试聊 | 新用户从空环境可按步骤完成首次运行 |
| Overview 任务化 | 展示阻塞项和下一步 | 未安装、未配置模型、未启动、无模型都有明确 CTA |
| 模型目录健康检查 | 判断目录存在、可读、是否有 GGUF | Config/Models 页面能显示目录状态 |
| Discover 摘要 | 显示扫描结果、失败原因和耗时 | 用户知道发现了什么、没发现为什么 |
| Chat smoke test | Chat 明确作为验证工具 | 一键发送测试 prompt，失败给出诊断入口 |

### P2：运维增强和维护成本降低

| 项目 | 目标 | 验收标准 |
| --- | --- | --- |
| Runtime core 抽取 | Next API 和 fallback server 共享核心逻辑 | Runtime、config、process、logs 逻辑不再双写 |
| 日志增强 | 支持过滤、自动滚动、导出、错误高亮 | Logs 可用于实际排障 |
| Diagnostics 面板 | 汇总 health、metrics、gpu-info、端口、模型目录 | 一页输出诊断报告 |
| Chat 增强 | 支持停止生成、复制、历史、参数 preset | Chat 可用于稳定验证模型 |
| API contract tests | 覆盖失败态、并发态、边界态 | Runtime、settings、chat、logs 都有 API 级测试 |
| 移动端导航 | 采用 bottom navigation 或 drawer | 390px 宽度下导航更自然，操作不拥挤 |

## 6. 分阶段实施计划

### 阶段 1：操作反馈和安全边界

周期：1 到 3 天。

范围：

- Runtime 操作互斥锁。
- Toast/Snackbar。
- Confirm dialog。
- Linear progress。
- 中文错误映射。
- system theme 修复。
- 中文 label uppercase 修复。

交付物：

- 用户执行 Runtime 操作时能看到完整状态反馈。
- 卸载和回滚不会被误触。
- 常见错误能引导下一步。

验证：

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- Runtime 相关 E2E 增补确认弹窗和 pending 状态。

### 阶段 2：首次设置向导

周期：3 到 5 天。

范围：

- 新增 Setup flow 或把 Overview 改造成 setup checklist。
- 步骤包括：检查 Shimmy、安装 runtime、选择模型目录、发现模型、启动服务、发送测试消息。
- 每一步有完成状态、失败原因和重试按钮。

交付物：

- 空环境用户不需要阅读 README，也能完成首次启动。
- Overview 能明确告诉用户“下一步做什么”。

验证：

- E2E 覆盖空环境首次设置。
- E2E 覆盖已有外部 Shimmy 服务连接。
- E2E 覆盖无模型目录和模型目录无效。

### 阶段 3：诊断和模型运维

周期：1 周。

范围：

- Models 页面增加目录健康、默认模型 badge、probe 结果详情。
- Logs 页面增加 stream 过滤、自动滚动、复制、导出。
- 新增 Diagnostics 区块或面板，汇总 `/health`、`/metrics`、`gpu-info`、端口和配置。

交付物：

- 用户能在 UI 内定位“为什么启动失败、为什么没有模型、为什么 chat 失败”。
- 日志可作为排障材料导出。

验证：

- fake Shimmy 增加错误 fixture。
- API tests 覆盖 health/metrics/models/gpu-info 失败态。
- Playwright 覆盖日志过滤和诊断入口。

### 阶段 4：架构收敛

周期：1 到 2 周。

范围：

- 抽出共享 runtime core。
- Next API route 和 fallback server 复用同一核心模块。
- 给 runtime metadata 写入增加原子写和锁。
- GitHub Release 请求增加缓存、超时、rate limit 展示。
- Chat proxy 增加请求限制、超时、Abort 支持。

交付物：

- 管理逻辑只有一个权威实现。
- fallback 和 Next 行为一致性由测试保证。
- 并发点击和网络失败不会破坏本地状态。

验证：

- Node tests 覆盖共享 runtime core。
- API contract tests 覆盖 Next route。
- fallback smoke tests 覆盖同样生命周期。
- audit 升级方案执行后完整验证。

### 阶段 5：Material You 完整体验

周期：持续。

范围：

- 移动端 bottom navigation 或 drawer。
- Material motion。
- focus ring 和 aria-live。
- 长 path、checksum 的复制和折叠。
- 设计 token 文档。
- 可视化回归截图。

交付物：

- 桌面和移动端都符合统一设计规范。
- 关键操作有动效和语义反馈。
- UI 组件可以稳定复用。

验证：

- Playwright 桌面和移动截图。
- 可访问性 smoke。
- 无文本溢出、无横向滚动、无交互重叠。

## 7. 二期建议新增文档和工件

建议后续补充：

- `docs/runtime-core-architecture.md`：记录 Next/fallback 共享核心设计。
- `docs/setup-flow-spec.md`：记录首次设置向导的用户路径和验收标准。
- `docs/ui-material-you-guidelines.md`：记录颜色、形状、按钮、表格、toast、dialog 规范。
- `docs/error-message-map.md`：记录错误码、中文文案和用户下一步建议。

## 8. 风险和取舍

- 依赖升级可能触发 Next、Vitest、ESLint 配置变更，必须单独分支处理。
- 共享 runtime core 会碰到 ESM/CJS/fallback 兼容问题，需要先设计模块边界。
- Setup 向导会改变首页信息架构，必须保持熟练用户的快捷入口。
- 本地 Web UI 没有认证，仍应默认绑定 `127.0.0.1`，不要引导用户暴露到公网。
- Runtime 安装能力必须继续限制在 `~/.shimmy-ui/bin`，不能扩大到系统路径删除或覆盖。

## 9. 二期完成定义

二期完成时应满足：

1. 空环境用户可以通过 UI 完成首次安装、配置、发现模型、启动和试聊。
2. Runtime 下载、安装、更新、卸载、回滚都有进度、确认、结果反馈和错误建议。
3. 常见失败可以在 Overview 或 Diagnostics 中定位。
4. Next 和 fallback 关键管理逻辑不再分叉。
5. 依赖安全风险已有处理或明确的版本升级记录。
6. 桌面和移动端通过截图检查，无横向溢出、无明显遮挡、无关键文本溢出。
7. `npm run lint`、`npm run test`、`npm run typecheck`、`npm run build`、`npm run test:e2e` 通过。
