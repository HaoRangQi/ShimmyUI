# Goal

推进 `docs/phase-2-roadmap.md` 的阶段 1：操作反馈和安全边界。首个可交付切片聚焦 P0 可信操作闭环，先让 Runtime 生命周期操作具备互斥保护、用户反馈、危险操作确认、进行中状态、中文错误建议，并修复 `system` theme 和中文 label uppercase 问题。

# Architecture

- Runtime 写入操作的权威保护放在服务端管理层：`src/lib/shimmy/runtime-manager.ts` 和 zero-dependency fallback 的 `server/shimmy-manager.mjs`。
- UI 反馈组件放在 `src/components/ui.tsx`，页面状态编排留在 `src/app/page.tsx`。
- Runtime 面板只负责展示与触发 intent，不持有 mutation 细节。

# Tech Stack

Next.js 14、React 18、TanStack Query、TypeScript、Tailwind CSS、Vitest、Testing Library、Playwright。

# Baseline/Authority Refs

- `docs/phase-2-roadmap.md`：P0 验收标准。
- `README.md`：Next 和 fallback server 都是受支持入口。
- `src/lib/shimmy/runtime-manager.ts`：Next Runtime 管理逻辑。
- `server/shimmy-manager.mjs`：fallback Runtime 管理逻辑。
- `tests/e2e/shimmy-ui.spec.ts`：现有用户路径覆盖。

# Compatibility Boundary

- 不引入账号、远程部署、模型下载器、多实例编排。
- 不扩大 Runtime 安装范围，仍只管理 `~/.shimmy-ui/bin`。
- fallback server 的 runtime 行为必须与 Next manager 保持同类安全边界。
- 现有 API path 和返回 JSON 结构保持兼容，只允许增加字段或更清晰的错误状态。

# Verification

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run test:e2e`
- `node --test tests/node/shimmy-manager.test.mjs`

# Plan Basis

事实：
- Runtime 下载、安装、更新、卸载、回滚已经存在，但没有跨请求互斥。
- UI 的 mutation 只 invalidate query，没有统一成功/失败反馈。
- 卸载和回滚直接触发，没有二次确认。
- `theme: "system"` 当前被当成 dark。
- `Field`/表头 label 使用 uppercase，对中文不自然。

假设：
- 阶段 1 可以先以 indeterminate linear progress 表示进行中；真实下载百分比留给后续更深的 streaming/download progress 切片。
- 错误翻译先在 UI 层做规则映射，服务端继续返回原始错误，方便排障。

未知：
- GitHub Release 真实网络错误和 rate limit 的详细产品文案需要后续专门覆盖。

# Plan Pressure Test

- Owner / contract / retirement：服务端互斥属于 runtime manager；UI 反馈属于页面状态；后续 Runtime core 抽取时迁移到共享 core。
- Verification scope：unit 覆盖互斥和 UI 行为，E2E 覆盖用户可见确认/反馈。
- Task executability：每个任务可在 2 到 5 分钟内独立提交。
- Pressure result：proceed。

# Plan-Time Complexity Check

- Target files：`src/app/page.tsx`、`src/components/ui.tsx`、`src/components/dashboard/runtime-panel.tsx`、`src/lib/shimmy/runtime-manager.ts`、`server/shimmy-manager.mjs`。
- Existing size / shape signals：`page.tsx` 已承担状态编排，但新增反馈状态仍符合页面 owner；runtime manager 是现有 Runtime owner。
- Owner fit：互斥不放 route handler，避免每个 API route 重复；UI 组件不持有业务动作。
- Add-in-place risk：fallback 和 Next 双写会继续存在，但 P0 需要同步最小行为。
- Better file boundary：新增小型 helper/组件，避免扩大面板职责。
- Recommendation：edit-in-place，并为共享 Runtime core 抽取保留后续阶段任务。

# Tasks

1. Runtime 互斥 RED/GREEN
- Files：`src/lib/shimmy/runtime-manager.test.ts`、`src/lib/shimmy/runtime-manager.ts`、`tests/node/shimmy-manager.test.mjs`、`server/shimmy-manager.mjs`
- Why：防止连续点击导致重复写入或 metadata 错乱。
- Verification：`npm run test -- src/lib/shimmy/runtime-manager.test.ts`、`node --test tests/node/shimmy-manager.test.mjs`

2. UI 反馈和确认 RED/GREEN
- Files：`src/app/page.test.tsx`、`src/app/page.tsx`、`src/components/ui.tsx`、`src/components/dashboard/runtime-panel.tsx`
- Why：关键操作需要成功、失败、进行中反馈；危险操作必须确认。
- Verification：`npm run test -- src/app/page.test.tsx`

3. Theme 和 label 样式 RED/GREEN
- Files：`src/app/page.test.tsx`、`src/app/page.tsx`、`src/components/ui.tsx`
- Why：`system` 主题必须真实跟随系统；中文 label 不应 uppercase。
- Verification：`npm run test -- src/app/page.test.tsx`

4. E2E 和全量验证
- Files：`tests/e2e/shimmy-ui.spec.ts`
- Why：覆盖真实用户路径和 Runtime 操作确认边界。
- Verification：`npm run lint`、`npm run test`、`npm run typecheck`、`npm run test:e2e`

# Risks

- fallback 和 Next 仍存在重复实现，后续阶段 4 需要抽 Runtime core。
- jsdom 对 `matchMedia` 需要测试 stub，不能代表完整浏览器视觉验证。
- `next lint` 依赖旧 Next CLI，可能受当前依赖版本约束。

# Retirement

- UI 层错误翻译后续可迁移为共享 error map 文档和模块。
- Runtime 互斥锁后续随 Runtime core 抽取，删除 Next/fallback 双写版本。
