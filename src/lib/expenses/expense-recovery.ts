import type { QueryClient } from "@tanstack/react-query";
import {
  getExpenses,
  getExpenseSummary,
  getExpenseKrwSummary,
  getExpenseBudget,
  getExpenseCurrencies,
} from "@/lib/api/rooms/expenses";
import { getRoomMembers } from "@/lib/api/rooms/members";
import { expenseKeys } from "./expense-queries";

type Scope = "all" | "expenses" | "budget" | "visible";
type Status = "pending" | "ready" | "error" | "revoked";
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
  private listeners = new Set<() => void>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private running: Promise<void> | null = null;
  private unsubscribeQueryCache: () => void;
  // Advances for authoritative reads and local writes, fencing late mutations.
  listRevision = 0;
  constructor(
    private client: QueryClient,
    private roomId: string,
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
    this.pending.clear();
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
  refresh = (scope: Scope): Promise<void> => {
    if (this.status === "revoked") return Promise.resolve();
    const keys =
      scope === "budget"
        ? ["budget"]
        : scope === "expenses"
          ? ["list", "summary", "summary-krw"]
          : ["list", "summary", "summary-krw", "budget", "currencies", "members"];
    keys.forEach((key) => this.pending.add(key));
    this.setStatus("pending");
    if (!this.running) {
      this.running = Promise.resolve()
        .then(() => this.drain())
        .finally(() => {
          this.running = null;
        });
    }
    return this.running;
  };
  private async drain() {
    let failure: unknown;
    while (this.pending.size && this.status !== "revoked") {
      const keys = [...this.pending];
      this.pending.clear();
      const reads: Record<string, () => Promise<unknown>> = {
        list: () => getExpenses(this.roomId),
        summary: () => getExpenseSummary(this.roomId),
        "summary-krw": () => getExpenseKrwSummary(this.roomId),
        budget: () => getExpenseBudget(this.roomId),
        currencies: () => getExpenseCurrencies(this.roomId),
        members: () => getRoomMembers(this.roomId),
      };
      const results = await Promise.allSettled(
        keys.map(async (key) => {
          const queryKey = ["room-expenses", this.roomId, key];
          await this.client.cancelQueries({ queryKey, exact: true });
          if (this.getSnapshot() === "revoked") return;
          try {
            await this.client.fetchQuery({
              queryKey,
              queryFn: reads[key],
              staleTime: 0,
              retry: false,
            });
            this.failed.delete(key);
          } catch (error) {
            this.failed.add(key);
            this.handleError(error);
            throw error;
          }
        }),
      );
      for (const result of results)
        if (result.status === "rejected") {
          failure = result.reason;
          this.handleError(failure);
        }
    }
    if (this.status !== "revoked")
      this.setStatus(this.failed.size ? "error" : "ready");
    if (failure) throw failure;
  }
}
