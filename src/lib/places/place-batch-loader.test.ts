import { describe, expect, it, vi } from "vitest";

import { PLACE_BATCH_MAX_SIZE } from "@/lib/api/batch-chunk";
import { createPlaceBatchLoader, type PlaceBatchResult } from "@/lib/places/place-batch-loader";

type Outcome = "ok" | "failed" | "missing";

/** id마다 응답 결과를 정한 batch 응답을 만든다 */
function batchResponse(ids: string[], outcomeOf: (id: string) => Outcome) {
  const results = new Map<string, PlaceBatchResult<string>>();
  for (const id of ids) {
    const outcome = outcomeOf(id);
    if (outcome === "ok") results.set(id, { ok: true, value: `many:${id}` });
    if (outcome === "failed") results.set(id, { ok: false, error: new Error(`failed:${id}`) });
  }
  return results;
}

function createLoader(outcomeOf: (id: string, call: number) => Outcome = () => "ok") {
  let call = 0;
  const fetchOne = vi.fn(async (id: string) => `one:${id}`);
  const fetchMany = vi.fn(async (ids: string[]) => {
    call += 1;
    return batchResponse(ids, (id) => outcomeOf(id, call));
  });
  return { fetchOne, fetchMany, load: createPlaceBatchLoader({ fetchOne, fetchMany }) };
}

describe("createPlaceBatchLoader", () => {
  it("같은 태스크에서 들어온 id는 batch 하나로 보내고 같은 id는 한 번만 싣는다", async () => {
    const { fetchOne, fetchMany, load } = createLoader();

    await expect(Promise.all([load("a"), load("b"), load("a")])).resolves.toEqual([
      "many:a",
      "many:b",
      "many:a",
    ]);
    expect(fetchMany).toHaveBeenCalledExactlyOnceWith(["a", "b"]);
    expect(fetchOne).not.toHaveBeenCalled();
  });

  it("한 건만 들어오면 단건 API로 보낸다", async () => {
    const { fetchOne, fetchMany, load } = createLoader();

    await expect(load("a")).resolves.toBe("one:a");
    expect(fetchOne).toHaveBeenCalledExactlyOnceWith("a");
    expect(fetchMany).not.toHaveBeenCalled();
  });

  it("다른 태스크에서 들어온 요청은 따로 보낸다", async () => {
    const { fetchOne, load } = createLoader();

    await load("a");
    await load("b");
    expect(fetchOne.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("실패한 항목이 여러 개면 그 id만 batch로 한 번 더 보낸다", async () => {
    const { fetchOne, fetchMany, load } = createLoader((id, call) =>
      call === 1 && id !== "a" ? "failed" : "ok",
    );

    await expect(Promise.all([load("a"), load("b"), load("c")])).resolves.toEqual([
      "many:a",
      "many:b",
      "many:c",
    ]);
    expect(fetchMany.mock.calls).toEqual([[["a", "b", "c"]], [["b", "c"]]]);
    expect(fetchOne).not.toHaveBeenCalled();
  });

  it("실패한 항목이 하나면 단건 API로 한 번 더 보낸다", async () => {
    const { fetchOne, fetchMany, load } = createLoader((id) => (id === "b" ? "failed" : "ok"));

    await expect(Promise.all([load("a"), load("b")])).resolves.toEqual(["many:a", "one:b"]);
    expect(fetchMany).toHaveBeenCalledTimes(1);
    expect(fetchOne).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("다시 보낸 요청에서도 실패하면 그 id는 실패로 끝내고 더 보내지 않는다", async () => {
    const { fetchOne, fetchMany, load } = createLoader((id) => (id === "a" ? "ok" : "failed"));

    const settled = await Promise.allSettled([load("a"), load("b"), load("c")]);

    expect(settled.map((result) => result.status)).toEqual(["fulfilled", "rejected", "rejected"]);
    expect(fetchMany).toHaveBeenCalledTimes(2);
    expect(fetchOne).not.toHaveBeenCalled();
  });

  it("batch 응답에서 빠진 id도 실패처럼 한 번 더 받는다", async () => {
    const { fetchMany, load } = createLoader((id, call) =>
      call === 1 && id !== "a" ? "missing" : "ok",
    );

    await expect(Promise.all([load("a"), load("b"), load("c")])).resolves.toEqual([
      "many:a",
      "many:b",
      "many:c",
    ]);
    expect(fetchMany.mock.calls).toEqual([[["a", "b", "c"]], [["b", "c"]]]);
  });

  it("첫 요청 자체가 실패하면 모은 id 모두 같은 에러로 실패하고 다시 보내지 않는다", async () => {
    const failure = new Error("batch failed");
    const fetchMany = vi.fn(async () => {
      throw failure;
    });
    const fetchOne = vi.fn(async (id: string) => `one:${id}`);
    const load = createPlaceBatchLoader({ fetchOne, fetchMany });

    const settled = await Promise.allSettled([load("a"), load("b")]);

    expect(settled).toEqual([
      { status: "rejected", reason: failure },
      { status: "rejected", reason: failure },
    ]);
    expect(fetchMany).toHaveBeenCalledTimes(1);
    expect(fetchOne).not.toHaveBeenCalled();
  });

  it("다시 보낸 요청 자체가 실패하면 실패한 id만 그 에러로 끝난다", async () => {
    const failure = new Error("retry failed");
    const fetchMany = vi
      .fn()
      .mockResolvedValueOnce(batchResponse(["a", "b", "c"], (id) => (id === "a" ? "ok" : "failed")))
      .mockRejectedValueOnce(failure);
    const fetchOne = vi.fn(async (id: string) => `one:${id}`);
    const load = createPlaceBatchLoader<string>({ fetchOne, fetchMany });

    const settled = await Promise.allSettled([load("a"), load("b"), load("c")]);

    expect(settled).toEqual([
      { status: "fulfilled", value: "many:a" },
      { status: "rejected", reason: failure },
      { status: "rejected", reason: failure },
    ]);
  });

  describe("서버 한도를 넘으면", () => {
    const ids = Array.from({ length: PLACE_BATCH_MAX_SIZE + 20 }, (_, index) => `p${index}`);
    const head = ids.slice(0, PLACE_BATCH_MAX_SIZE);
    const tail = ids.slice(PLACE_BATCH_MAX_SIZE);
    const fulfilled = (id: string) => ({ status: "fulfilled", value: `many:${id}` });

    it("나눠 차례로 보내고, 뒤 묶음 요청이 실패해도 앞 묶음에서 받은 값은 쓴다", async () => {
      const failure = new Error("rate limited");
      const fetchMany = vi
        .fn()
        .mockResolvedValueOnce(batchResponse(head, () => "ok"))
        .mockRejectedValueOnce(failure);
      const fetchOne = vi.fn(async (id: string) => `one:${id}`);
      const load = createPlaceBatchLoader<string>({ fetchOne, fetchMany });

      const settled = await Promise.allSettled(ids.map((id) => load(id)));

      expect(fetchMany.mock.calls).toEqual([[head], [tail]]);
      expect(settled).toEqual([
        ...head.map(fulfilled),
        ...tail.map(() => ({ status: "rejected", reason: failure })),
      ]);
    });

    it("앞 묶음 요청이 실패하면 남은 묶음은 보내지 않고 모두 같은 에러로 실패한다", async () => {
      const failure = new Error("rate limited");
      const fetchMany = vi.fn().mockRejectedValueOnce(failure);
      const fetchOne = vi.fn(async (id: string) => `one:${id}`);
      const load = createPlaceBatchLoader<string>({ fetchOne, fetchMany });

      const settled = await Promise.allSettled(ids.map((id) => load(id)));

      expect(fetchMany).toHaveBeenCalledTimes(1);
      expect(settled).toEqual(ids.map(() => ({ status: "rejected", reason: failure })));
    });

    it("묶음마다 실패한 항목을 모아 한 번에 다시 보낸다", async () => {
      const { fetchMany, load } = createLoader((id, call) =>
        call <= 2 && (id === head[0] || id === tail[0]) ? "failed" : "ok",
      );

      const settled = await Promise.allSettled(ids.map((id) => load(id)));

      expect(fetchMany.mock.calls).toEqual([[head], [tail], [[head[0], tail[0]]]]);
      expect(settled).toEqual(ids.map(fulfilled));
    });

    it("요청이 실패한 묶음이 있으면 앞 묶음의 실패 항목도 다시 보내지 않는다", async () => {
      const failure = new Error("rate limited");
      const fetchMany = vi
        .fn()
        .mockResolvedValueOnce(batchResponse(head, (id) => (id === head[0] ? "failed" : "ok")))
        .mockRejectedValueOnce(failure);
      const fetchOne = vi.fn(async (id: string) => `one:${id}`);
      const load = createPlaceBatchLoader<string>({ fetchOne, fetchMany });

      const settled = await Promise.allSettled(ids.map((id) => load(id)));

      expect(fetchMany).toHaveBeenCalledTimes(2);
      expect(fetchOne).not.toHaveBeenCalled();
      expect(settled).toEqual([
        { status: "rejected", reason: new Error(`failed:${head[0]}`) },
        ...head.slice(1).map(fulfilled),
        ...tail.map(() => ({ status: "rejected", reason: failure })),
      ]);
    });
  });
});
