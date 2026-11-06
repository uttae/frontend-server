import { isCancelledError, type QueryClient } from "@tanstack/react-query";
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
/** 같은 틱에 들어온 다시 받기 요청을 한 번에 무효화한다 */
type Batch = { keys: Set<ReadKey>; restartFirstLoads: boolean; promise: Promise<void> };
let generation = 0;
let revocation = 0;
const controllers = new WeakMap<
  QueryClient, Map<string, ReturnType<typeof createStore>>
>();
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

/** Every authoritative exit fences admission, even if the controller was already revoked. */
export function revokeExpenseRoomAccess(client: QueryClient, roomId: string) {
  const store = getExpenseRecoveryStore(client, roomId);
  store.lastRevocation = ++revocation;
  store.current.revoke();
}

/** Capture BEFORE the server request; cached data and reconnects are not admission. */
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
  // Advances for authoritative reads and local writes, fencing late mutations.
  listRevision = 0;
  constructor(
    private readonly client: QueryClient,
    private readonly roomId: string,
  ) {
    this.unsubscribeQueryCache = client.getQueryCache().subscribe((event) => {
      if (
        event.type !== "updated" ||
        event.query.queryKey[0] !== "room-expenses" ||
        event.query.queryKey[1] !== roomId
      )
        return;
      if (event.action.type === "success" && event.query.queryKey[2] === "list")
        this.listRevision++;
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
    if (
      e?.status === 403 ||
      (e?.status === 404 && e.code !== "EXPENSE_NOT_FOUND")
    )
      this.revoke();
  };
  message = (body: string): Promise<void> => {
    try {
      const event = JSON.parse(body);
      if (event?.roomId !== this.roomId) return Promise.resolve();
      if (event.type === "EXPENSES_INVALIDATED")
        return this.refresh("expenses");
      if (event.type === "BUDGET_INVALIDATED") return this.refresh("budget");
    } catch {
      /* Invalid frames are not data. */
    }
    return Promise.resolve();
  };
  /**
   * 범위의 가계부 조회를 무효화한다. 화면에 있는 조회(ExpenseProvider)만 그 queryFn으로 바로 다시 받고,
   * 나머지는 다시 볼 때 받는다. 받는 중인 옛 조회는 TanStack이 취소하고(그 응답은 버려짐) 새로 받는다.
   * 같은 틱에 온 요청(중복 프레임·변경 알림 여러 개)은 한 번에 무효화해 요청을 반복하지 않는다.
   */
  refresh = (scope: Scope): Promise<void> => {
    if (this.status === "revoked") return Promise.resolve();
    // A tab return revalidates cached data without clearing the visible ledger.
    // focus and visibilitychange can describe the same return.
    if (scope === "visible" && this.status === "refreshing" && this.running) return this.running;
    // 보이던 장부를 두고 다시 받는다(refreshing): 탭 복귀·변경 알림·본인 저장 뒤. 금액을 '—'로 바꾸지 않는다(AGENTS.md 로딩 원칙).
    // 입장·연결 복구·재시도(all)와 아직 맞춰지지 않은 장부(pending·error)는 처음부터 맞춘다(pending)
    const background =
      scope !== "all" && (this.status === "ready" || this.status === "refreshing");
    this.setStatus(background ? "refreshing" : "pending");
    const batch = (this.queued ??= this.startBatch());
    SCOPE_READS[scope].forEach((key) => batch.keys.add(key));
    // 변경 알림·본인 저장 뒤에는 그 변경 전에 출발했을 수 있는 첫 조회도 다시 받는다.
    // 입장·연결 복구의 첫 조회는 구독 뒤에 출발했으므로 합류한다
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
    // 다음 마이크로태스크에 보낸다 — 같은 틱의 요청을 모으고, 입장 때는 조회 observer가 붙은 뒤에 무효화한다
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
        if (restartFirstLoads) {
          // 데이터가 없는(처음 받는 중인) 조회는 TanStack이 취소하지 않고 합류만 한다
          await this.client.cancelQueries({
            queryKey,
            predicate: (query) => query.state.data === undefined,
          });
        }
        try {
          // summary-krw는 접두로 필터별 스냅샷도 함께 무효화한다(보는 필터만 다시 받는다)
          await this.client.invalidateQueries({ queryKey }, { throwOnError: true });
          this.failed.delete(key);
        } catch (error) {
          // 더 새 조회로 바뀌었거나 화면이 사라져 취소된 조회는 실패가 아니다
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
