import { chunkArray, PLACE_BATCH_MAX_SIZE } from "@/lib/api/batch-chunk";

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
    const { failed } = first.stopped ? first : await send([...first.failed.keys()]);
    for (const [id, result] of failed) settle(id, result);
  }

  return (id) => {
    const inFlight = pending.get(id);
    if (inFlight) return inFlight.promise;

    const deferred = createDeferred<T>();
    pending.set(id, deferred);
    if (!queued.length) setTimeout(() => void flush(), 0);
    queued.push(id);
    return deferred.promise;
  };
}
