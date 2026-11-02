// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DestinationSearchInput } from "./DestinationSearchInput";
import { Label } from "@/components/ui/label";

vi.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it.each(["default", "field"] as const)("preserves clear behavior and focus for %s appearance", async (appearance) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const change = vi.fn();
  const resolved = vi.fn();
  try {
    await act(async () => root.render(<DestinationSearchInput appearance={appearance} value="서울" onChange={change} onResolvedPlace={resolved} />));
    const input = host.querySelector("input")!;
    const clear = host.querySelector<HTMLButtonElement>('button[aria-label="지우기"]')!;
    expect(input.value).toBe("서울");
    await act(async () => clear.click());
    expect(input.value).toBe("");
    expect(change).toHaveBeenCalledExactlyOnceWith("");
    expect(resolved).toHaveBeenCalledExactlyOnceWith(null);
    expect(document.activeElement).toBe(input);
    expect(host.querySelector("button")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("retains the selection-only hint association and does not refocus when cleared", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<DestinationSearchInput appearance="field" selectionOnly value="서울" onChange={vi.fn()} />));
    const input = host.querySelector("input")!;
    const hint = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(input.getAttribute("role")).toBe("combobox");
    expect(hint?.textContent).toContain("목록에서 선택");
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="선택 지우기"]')!.click());
    expect(document.activeElement).not.toBe(input);
    expect(input.value).toBe("");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("forwards the label control association and children", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<><Label htmlFor="destination">목적지</Label><input id="destination" /></>));
    expect(host.querySelector("label")?.control).toBe(host.querySelector("input"));
    expect(host.querySelector("label")?.textContent).toBe("목적지");
  } finally {
    await act(async () => root.unmount());
  }
});
