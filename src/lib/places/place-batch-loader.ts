import { chunkArray, PLACE_BATCH_MAX_SIZE } from "@/lib/api/batch-chunk";

/** batch 응답 항목 하나 — 받은 값, 또는 그 항목만의 실패 */
export type PlaceBatchResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * 같은 태스크에서 요청된 장소 id를 모아 서버 한도(100곳)씩 차례로 보낸다. 한 번에 1건이면 단건 API, 2건 이상이면
 * batch API를 쓴다 — batch rate limit(사용자당 분당)이 단건보다 작아서 1건짜리 batch는 한도만 먼저 쓴다.
 * 항목이 실패하면 실패한 id만 같은 방식으로 한 번 더 보내고, 그래도 실패하면 그 id는 실패로 끝낸다.
 * 요청 자체가 실패하면 그 묶음과 아직 보내지 않은 id가 그 에러로 실패하고, 실패한 항목도 다시 보내지 않는다 —
 * 앞 묶음에서 받은 값은 그대로 쓴다. 다시 보낼지는 TanStack 재시도 규칙이 정한다.
 */
export function createPlaceBatchLoader<T>({
  fetchOne,
  fetchMany,
}: {
  fetchOne: (id: string) => Promise<T>;
  fetchMany: (ids: string[]) => Promise<ReadonlyMap<string, PlaceBatchResult<T>>>;
}): (id: string) => Promise<T> {
  const pending = new Map<string, Deferred<T>>();
  let queued: string[] = [];

  function settle(id: string, result: PlaceBatchResult<T>) {
    const deferred = pending.get(id);
    pending.delete(id);
    if (!deferred) return;
    if (result.ok) deferred.resolve(result.value);
    else deferred.reject(result.error);
  }

  async function request(ids: string[]): Promise<ReadonlyMap<string, PlaceBatchResult<T>>> {
    if (ids.length > 1) return fetchMany(ids);
    const [id] = ids;
    return new Map<string, PlaceBatchResult<T>>([[id, { ok: true, value: await fetchOne(id) }]]);
  }

  /** 받은 값은 바로 끝내고, 항목이 실패했거나 응답에 없던 id는 실패 결과로 돌려준다 */
  async function send(ids: string[]) {
    const failed = new Map<string, PlaceBatchResult<T>>();
    const chunks = chunkArray(ids, PLACE_BATCH_MAX_SIZE);
    for (const [index, chunk] of chunks.entries()) {
      let results: ReadonlyMap<string, PlaceBatchResult<T>>;
      try {
        results = await request(chunk);
      } catch (error) {
        for (const id of chunks.slice(index).flat()) settle(id, { ok: false, error });
        return { failed, stopped: true };
      }
      for (const id of chunk) {
        const result: PlaceBatchResult<T> = results.get(id) ?? {
          ok: false,
          error: new Error(`batch 응답에 ${id}가 없음`),
        };
        if (result.ok) settle(id, result);
        else failed.set(id, result);
      }
    }
    return { failed, stopped: false };
  }

  async function flush() {
    const ids = queued;
    queued = [];

    const first = await send(ids);
    // 요청이 실패했으면 실패한 항목도 다시 보내지 않는다 — 실패 직후에 보내면 같은 이유(429·5xx)로 또 실패한다
    const { failed } = first.stopped ? first : await send([...first.failed.keys()]);
    for (const [id, result] of failed) settle(id, result);
  }

  return (id) => {
    const inFlight = pending.get(id);
    if (inFlight) return inFlight.promise;

    const deferred = createDeferred<T>();
    pending.set(id, deferred);
    // 같은 커밋에서 마운트된 카드들의 요청이 이번 태스크 안에 다 들어온 뒤 한 번에 보낸다
    if (!queued.length) setTimeout(() => void flush(), 0);
    queued.push(id);
    return deferred.promise;
  };
}
