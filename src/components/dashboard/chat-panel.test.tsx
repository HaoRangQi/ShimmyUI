import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dictionaries } from "@/lib/i18n";
import { ChatPanel } from "./chat-panel";
import type { GenerationSettings } from "./types";

const t = dictionaries.zh;
const modelRows = [
  {
    name: "tinyllama-1.1b",
    source: "discovered",
  },
];

function renderChatPanel(
  overrides: Partial<React.ComponentProps<typeof ChatPanel>> = {},
) {
  const props = {
    t,
    modelRows,
    selectedModel: "tinyllama-1.1b",
    setSelectedModel: vi.fn(),
    generation: {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 128,
    } satisfies GenerationSettings,
    setGeneration: vi.fn(),
    chatPrompt: "你好",
    setChatPrompt: vi.fn(),
    chatOutput: "Shimmy is ready.",
    chatBusy: false,
    runChat: vi.fn(),
    stopChat: vi.fn(),
    copyResponse: vi.fn(),
    applyPreset: vi.fn(),
    chatHistory: [
      {
        id: "history-1",
        model: "tinyllama-1.1b",
        prompt: "测试提示词",
        response: "测试响应",
        createdAt: "2026-05-29T12:00:00.000Z",
      },
    ],
    restoreHistory: vi.fn(),
    ...overrides,
  };

  render(<ChatPanel {...props} />);
  return props;
}

describe("ChatPanel P2 operations", () => {
  it("supports parameter presets and response copy", async () => {
    const user = userEvent.setup();
    const props = renderChatPanel();

    await user.click(screen.getByRole("button", { name: "均衡" }));
    expect(props.applyPreset).toHaveBeenCalledWith("balanced");

    await user.click(screen.getByRole("button", { name: "复制响应" }));
    expect(props.copyResponse).toHaveBeenCalledWith("Shimmy is ready.");
  });

  it("shows a stop action while generation is running", async () => {
    const user = userEvent.setup();
    const props = renderChatPanel({ chatBusy: true });

    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "停止生成" }));

    expect(props.stopChat).toHaveBeenCalled();
  });

  it("renders chat history and restores a prior prompt", async () => {
    const user = userEvent.setup();
    const props = renderChatPanel();

    expect(screen.getByRole("heading", { name: "历史" })).toBeVisible();
    expect(screen.getByText("测试提示词")).toBeVisible();
    expect(screen.getByText("测试响应")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "恢复" }));
    expect(props.restoreHistory).toHaveBeenCalledWith(props.chatHistory[0]);
  });
});
