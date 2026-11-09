import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readScheduleRouteFromSessionStorage,
  writeScheduleRouteToSessionStorage,
} from "./planTravelLocalStorage";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

describe("구간 경로 sessionStorage", () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    vi.stubGlobal("sessionStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("출발 항목과 일정 지문이 같아도 도착 항목이 다르면 저장한 경로를 쓰지 않는다", () => {
    const toC = { distanceMeters: 999, durationSeconds: 60, travelMode: "DRIVING" };
    // 순서 저장 중 새 순서([1,3,2])로 그린 칸이 옛 순서([1,2,3])의 지문으로 1→3 경로를 저장한 경우
    writeScheduleRouteToSessionStorage("room-1", 10, 1, 3, "DRIVING", "fp-1-2-3", toC);

    expect(
      readScheduleRouteFromSessionStorage("room-1", 10, 1, 2, "DRIVING", "fp-1-2-3"),
    ).toBeUndefined();
    expect(
      readScheduleRouteFromSessionStorage("room-1", 10, 1, 3, "DRIVING", "fp-1-2-3"),
    ).toEqual(toC);
  });
});
