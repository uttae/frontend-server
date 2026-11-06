import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** 탭 ID는 모듈 변수에 한 번 만들어 두므로 경우마다 모듈을 새로 읽는다 */
async function loadGetTabId() {
  vi.resetModules();
  return (await import("@/lib/tab-id")).getTabId;
}

describe("getTabId", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null during server render", async () => {
    vi.unstubAllGlobals();
    const getTabId = await loadGetTabId();

    expect(getTabId()).toBeNull();
  });

  it("creates the ID once with randomUUID and keeps it for the tab", async () => {
    const randomUUID = vi.fn(() => "3f2b8c1e-7d4a-4e9b-9c2f-1a2b3c4d5e6f");
    vi.stubGlobal("crypto", { randomUUID, getRandomValues: vi.fn() });
    const getTabId = await loadGetTabId();

    expect(getTabId()).toBe("3f2b8c1e-7d4a-4e9b-9c2f-1a2b3c4d5e6f");
    expect(getTabId()).toBe("3f2b8c1e-7d4a-4e9b-9c2f-1a2b3c4d5e6f");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("builds a v4 UUID from getRandomValues when randomUUID is missing (non-secure context)", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff),
    });
    const getTabId = await loadGetTabId();

    const id = getTabId();
    expect(id).toMatch(UUID_V4);
    expect(id).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("returns null when the browser cannot make random values", async () => {
    vi.stubGlobal("crypto", {});
    const getTabId = await loadGetTabId();

    expect(getTabId()).toBeNull();
  });
});
