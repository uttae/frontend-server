// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function renderInput(flag: string | undefined, minimized = false) {
  vi.stubEnv("NEXT_PUBLIC_AI_ENABLED", flag);
  vi.resetModules();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  const { ChatInputBar } = await import("./ChatInputBar");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onSendChat = vi.fn();
  const onSendAi = vi.fn();
  await act(async () => root!.render(
    <ChatInputBar isMinimized={minimized} onSendChat={onSendChat} onSendAi={onSendAi} />,
  ));
  const input = host.querySelector("textarea")!;
  async function type(value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, value);
      input.setSelectionRange(value.length, value.length);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function send() {
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  }
  return { onSendChat, onSendAi, input, type, send };
}

it.each([false, true])("QA off hides AI controls and preserves normal chat (minimized=%s)", async (minimized) => {
  const view = await renderInput("false", minimized);
  expect([...host!.querySelectorAll("button")].some(button => button.textContent === "@ai")).toBe(false);
  await view.type("@");
  expect(host!.querySelector('[aria-label="@ai로 AI 질문 모드 적용"]')).toBeNull();
  await view.type("@ai 장소 추천해줘");
  expect(view.input.value).toBe("@ai 장소 추천해줘");
  await view.send();
  expect(view.onSendChat).toHaveBeenCalledExactlyOnceWith("@ai 장소 추천해줘");
  expect(view.onSendAi).not.toHaveBeenCalled();
  expect(view.input.value).toBe("");
  await view.type("일반 대화");
  await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="메시지 보내기"]')!.click());
  expect(view.onSendChat).toHaveBeenLastCalledWith("일반 대화");
});

it.each([undefined, "true"])("default/enabled retains AI toggle, suggestions and send (%s)", async (flag) => {
  const view = await renderInput(flag);
  const toggle = [...host!.querySelectorAll("button")].find(button => button.textContent === "@ai");
  expect(toggle).toBeDefined();
  await act(async () => toggle!.click());
  await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="입력란에 장소 추천 요청 문구 넣기"]')!.click());
  await view.send();
  expect(view.onSendAi).toHaveBeenCalledExactlyOnceWith("장소 추천해줘.");
  expect(view.onSendChat).not.toHaveBeenCalled();
});

it("default retains typed AI mention activation", async () => {
  const view = await renderInput(undefined);
  await view.type("@ai 대화 요약해줘");
  expect(view.input.value).toBe("대화 요약해줘");
  await view.send();
  expect(view.onSendAi).toHaveBeenCalledExactlyOnceWith("대화 요약해줘");
});
