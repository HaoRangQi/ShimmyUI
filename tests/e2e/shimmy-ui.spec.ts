import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

async function waitForState(page: Page, state: string) {
  await expect
    .poll(async () => {
      const response = await page.request.get("/api/app/status");
      return (await response.json()).state;
    }, { timeout: 10_000 })
    .toBe(state);
}

test.beforeEach(async ({ request }) => {
  await request.post("/api/shimmy/stop").catch(() => undefined);
  await expect
    .poll(async () => {
      const response = await request.get("/api/app/status");
      return (await response.json()).state;
    }, { timeout: 10_000 })
    .not.toBe("running-managed");
});

test.afterEach(async ({ request }) => {
  await request.post("/api/shimmy/stop").catch(() => undefined);
});

test("shows the Chinese local console on every viewport", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Shimmy UI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "概览", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "首次设置" })).toBeVisible();
  await expect(page.getByText("安装或选择 Shimmy", { exact: true })).toBeVisible();
  await expect(page.getByText("模型目录健康")).toBeVisible();
  await page.getByRole("button", { name: "运行时", exact: true }).click();
  await expect(page.getByText("托管路径")).toBeVisible();
  await page.getByRole("button", { name: "诊断", exact: true }).click();
  await expect(page.getByRole("heading", { name: "诊断", exact: true })).toBeVisible();
  await expect(page.getByText("诊断报告")).toBeVisible();
  await page.getByRole("button", { name: "日志", exact: true }).click();
  await expect(page.getByLabel("自动滚动")).toBeChecked();
  await expect(page.getByRole("button", { name: "导出" })).toBeVisible();
});

test("shows runtime failure feedback", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "运行时", exact: true }).click();
  await page.route("**/api/runtime/download", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Download failed: 503 Service Unavailable" }),
    });
  });
  await page.getByRole("button", { name: "下载" }).click();

  const snackbar = page.getByRole("alert").filter({ hasText: "网络请求失败" });
  await expect(snackbar).toContainText("网络请求失败");
  await expect(snackbar).toContainText("检查网络连接后重试");
});

test.describe("managed shimmy operations", () => {
  test.skip(({ isMobile }) => isMobile, "full lifecycle uses shared local ports");

  test("configures fake shimmy and runs the local lifecycle", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Shimmy UI" })).toBeVisible();
    await page.getByRole("button", { name: "配置", exact: true }).click();

    await page.getByLabel("Shimmy 路径").fill(
      path.join(process.cwd(), "tests", "fixtures", "fake-shimmy.js"),
    );
    await page.getByLabel("绑定地址").fill("127.0.0.1:11435");
    await page.getByRole("button", { name: "保存" }).click();
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/app/status");
        return (await response.json()).binary?.path;
      }, { timeout: 10_000 })
      .toContain("fake-shimmy.js");

    await page.getByRole("button", { name: "运行时", exact: true }).click();
    await expect(page.getByText("托管路径")).toBeVisible();

    await page.getByRole("button", { name: "启动" }).click();
    await waitForState(page, "running-managed");
    await page.getByRole("button", { name: "概览", exact: true }).click();
    await page.getByRole("button", { name: "刷新" }).click();
    await expect(page.getByRole("complementary").getByText("托管服务")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "模型", exact: true }).click();
    await expect(page.getByText("tinyllama-1.1b")).toBeVisible();

    await page.getByRole("button", { name: "对话" }).first().click();
    await expect(page.getByRole("button", { name: "均衡" })).toBeVisible();
    await expect(page.getByRole("button", { name: "停止生成" })).toBeHidden();
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.locator("pre").filter({ hasText: "Hi from fake Shimmy." })).toBeVisible();
    await expect(page.getByRole("button", { name: "复制响应" })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "历史" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "提示词" })).toHaveValue(
      "Say hi in five words.",
    );

    await page.getByRole("button", { name: "日志", exact: true }).click();
    await expect(page.getByText("fake shimmy serving")).toBeVisible();
    await page.request.post("/api/shimmy/stop");
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/app/status");
        return (await response.json()).state;
      }, { timeout: 10_000 })
      .not.toBe("running-managed");
  });
});
