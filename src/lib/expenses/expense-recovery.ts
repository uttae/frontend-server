import { isCancelledError, type QueryClient } from "@tanstack/react-query";
import { invalidateAfterChange } from "@/lib/query-client";
import { expenseKeys } from "./expense-queries";

type Scope = "all" | "expenses" | "budget" | "visible";
type Status = "pending" | "refreshing" | "ready" | "error" | "revoked";
type ReadKey = "list" | "summary" | "summary-krw" | "budget" | "currencies" | "members";
const ALL_READS: readonly ReadKey[] = ["list", "summary", "summary-krw", "budget", "currencies", "members"];
const SCOPE_READS: Record<Scope, readonly ReadKey[]> = {
  all: ALL_READS,
  visible: ALL_READS,
  expenses: ["list", "summary", "summary-krw"],
  budget: ["budget"],
};
type Batch = { keys: Set<ReadKey>; restartFirstLoads: boolean; promise: Promise<void> };
let generation = 0;
let revocation = 0;
const controllers = new WeakMap<QueryClient, Map<string, ReturnType<typeof createStore>>>();
function createStore(client: QueryClient, roomId: string) {
  const listeners = new Set<() => void>();
  const store = {
    current: new ExpenseRecovery(client, roomId),
    lastRevocation: 0,
    getSnapshot: () => store.current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replace: () => {
      store.current = new ExpenseRecovery(client, roomId);
      listeners.forEach((listener) => listener());
    },
  };
  return store;
}
export function getExpenseRecoveryStore(client: QueryClient, roomId: string) {
  let rooms = controllers.get(client);
  if (!rooms) {
    rooms = new Map();
    controllers.set(client, rooms);
  }
  let store = rooms.get(roomId);
  if (!store) {
    store = createStore(client, roomId);
    rooms.set(roomId, store);
  }
  return store;
}
export function getExpenseRecovery(client: QueryClient, roomId: string) {
  return getExpenseRecoveryStore(client, roomId).current;
}

export function revokeExpenseRoomAccess(client: QueryClient, roomId: string) {
  const store = getExpenseRecoveryStore(client, roomId);
  store.lastRevocation = ++revocation;
  store.current.revoke();
}

export function beginExpenseRoomAdmission(client: QueryClient) {
  const started = revocation;
  return (roomId: string, authorized: boolean) => {
    if (!authorized) return;
    const store = getExpenseRecoveryStore(client, roomId);
    if (store.lastRevocation > started) return;
    if (store.current.getSnapshot() === "revoked") store.replace();
  };
}
class ExpenseRecovery {
  readonly generation = ++generation;
  private status: Status = "pending";
  private readonly listeners = new Set<() => void>();
  private readonly failed = new Set<string>();
  private queued: Batch | null = null;
  private inFlight = 0;
  private running: Promise<void> | null = null;
  private readonly unsubscribeQueryCache: () => void;
  listRevision = 0;
  constructor(
    private readonly client: QueryClient,
    private readonly roomId: string,
  ) {
    this.unsubscribeQueryCache = client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.query.queryKey[0] !== "room-expenses" || event.query.queryKey[1] !== roomId)
        return;
      if (event.action.type === "success" && event.query.queryKey[2] === "list") this.listRevision++;
      if (event.action.type === "error") {
        this.handleError(event.action.error);
      }
    });
  }
  getSnapshot = () => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private setStatus(status: Status) {
    this.status = status;
    this.listeners.forEach((fn) => fn());
  }
  revoke = () => {
    if (this.status === "revoked") return;
    const store = getExpenseRecoveryStore(this.client, this.roomId);
    if (store.current === this) store.lastRevocation = ++revocation;
    this.unsubscribeQueryCache();
    this.listRevision++;
    this.setStatus("revoked");
    void this.client.cancelQueries({ queryKey: expenseKeys.room(this.roomId) });
    this.client.removeQueries({ queryKey: expenseKeys.room(this.roomId) });
  };
  handleError = (error: unknown) => {
    const e = error as { status?: number; code?: string } | null;
    if (e?.status === 403 || (e?.status === 404 && e.code !== "EXPENSE_NOT_FOUND")) this.revoke();
  };
  message = (body: string): Promise<void> => {
    try {
      const event = JSON.parse(body);
      if (event?.roomId !== this.roomId) return Promise.resolve();
      if (event.type === "EXPENSES_INVALIDATED") return this.refresh("expenses");
      if (event.type === "BUDGET_INVALIDATED") return this.refresh("budget");
    } catch {}
    return Promise.resolve();
  };
  refresh = (scope: Scope): Promise<void> => {
    if (this.status === "revoked") return Promise.resolve();
    if (scope === "visible" && this.status === "refreshing" && this.running) return this.running;
    const background = scope !== "all" && (this.status === "ready" || this.status === "refreshing");
    this.setStatus(background ? "refreshing" : "pending");
    const batch = (this.queued ??= this.startBatch());
    SCOPE_READS[scope].forEach((key) => batch.keys.add(key));
    if (scope === "expenses" || scope === "budget") batch.restartFirstLoads = true;
    return batch.promise;
  };
  private startBatch(): Batch {
    const batch: Batch = {
      keys: new Set(),
      restartFirstLoads: false,
      promise: Promise.resolve(),
    };
    this.inFlight++;
    batch.promise = Promise.resolve()
      .then(() => {
        if (this.queued === batch) this.queued = null;
        return this.invalidate([...batch.keys], batch.restartFirstLoads);
      })
      .finally(() => {
        if (--this.inFlight > 0 || this.status === "revoked") return;
        this.running = null;
        this.setStatus(this.failed.size ? "error" : "ready");
      });
    this.running = batch.promise;
    return batch;
  }
  private async invalidate(keys: ReadKey[], restartFirstLoads: boolean) {
    if (this.status === "revoked") return;
    let failure: unknown;
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        const queryKey = [...expenseKeys.room(this.roomId), key];
        try {
          await (restartFirstLoads
            ? invalidateAfterChange(this.client, { queryKey }, { throwOnError: true })
            : this.client.invalidateQueries({ queryKey }, { throwOnError: true }));
          this.failed.delete(key);
        } catch (error) {
          if (isCancelledError(error)) return;
          this.failed.add(key);
          throw error;
        }
      }),
    );
    for (const result of results)
      if (result.status === "rejected") {
        failure ??= result.reason;
        this.handleError(result.reason);
      }
    if (failure !== undefined) throw failure;
  }
}
