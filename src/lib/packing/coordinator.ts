import type { QueryClient } from '@tanstack/react-query';
import { packingApi, PackingApiError } from '@/lib/api/rooms/packing';
import type { PackingList, PackingItem, PackingPart } from './types';
import { packingQueryKey } from '@/lib/query-keys';
import { assertPackingChecked, assertPackingId, assertPackingVersion, normalizePackingMemo, normalizePackingName, PackingValidationError } from './validation';

export type PackingCommand =
  | { type: 'createPart'; name: string }
  | { type: 'renamePart'; id: number; name: string }
  | { type: 'createItem'; partId: number; name: string }
  | { type: 'renameItem'; id: number; name: string }
  | { type: 'checkItem'; id: number; checked: boolean }
  | { type: 'saveMemo'; id: number; content: string }
  | { type: 'deleteMemo'; id: number };
type DeleteCommand = { type: 'deletePart' | 'deleteItem'; id: number; confirmed: boolean };
type RestoreCommand = { type: 'restoreItem'; id: number; undoToken: string; item: PackingItem };
type Command = PackingCommand | DeleteCommand | RestoreCommand;
export type PackingOutcome = { kind: 'success' | 'error' | 'blocked' | 'missing' | 'confirmation'; createdPartId?: number };
export type PackingConfirmation = { kind: 'part' | 'item'; id: number; version: number; name: string };
export type PackingState = {
  data: PackingList | null;
  exitToHome?: boolean;
  status: 'loading' | 'ready' | 'writing' | 'sync-error' | 'uncertain' | 'error' | 'revoked';
  message: string | null;
  confirmation: PackingConfirmation | null;
  undo: { id: number; name: string; remainingMs: number }[];
};
type Undo = { item: PackingItem; token: string; deadline: number; timer: ReturnType<typeof setTimeout> };
const findItem = (list: PackingList, id: number) => list.parts.flatMap(p => p.items).find(i => i.id === id);
const uncertain = (e: unknown) => !(e instanceof PackingValidationError) && (!(e instanceof PackingApiError) || e.status >= 500);
const accessLost = (e: unknown) => e instanceof PackingApiError && (e.status === 401 || e.status === 403 || e.code === 'ROOM_NOT_FOUND');
const initialState = (): PackingState => ({ data: null, status: 'loading', message: null, confirmation: null, undo: [] });

/** One memory-only coordinator per exact room/principal query. No mutation retries. */
export class PackingCoordinator {
  private state = initialState();
  private listeners = new Set<() => void>();
  private generation = 0;
  private active = true;
  private busy = false;
  private reading: Promise<void> | null = null;
  private initAttempted = false;
  private undos = new Map<number, Undo>();
  readonly key;
  constructor(private client: QueryClient, readonly roomId: string, readonly userId: number) {
    this.key = packingQueryKey(roomId, userId);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<PackingState>) { this.state = { ...this.state, ...update }; this.listeners.forEach(fn => fn()); }
  private same(generation: number) { return this.active && this.generation === generation; }
  private setData(data: PackingList) {
    this.client.setQueryData(this.key, data);
    this.publish({ data });
    for (const [id, undo] of this.undos) if (!data.parts.some(p => p.id === undo.item.partId) || findItem(data, id)) this.dropUndo(id);
  }
  private purge() {
    this.generation++;
    void this.client.cancelQueries({ queryKey: this.key, exact: true });
    this.client.removeQueries({ queryKey: this.key, exact: true });
    for (const undo of this.undos.values()) clearTimeout(undo.timer);
    this.undos.clear();
    this.publish({ data: null, confirmation: null, undo: [] });
  }
  dispose() { this.active = false; this.purge(); this.listeners.clear(); }
  private revoke(error?: unknown) { this.purge(); this.active = false; this.publish({ status: 'revoked', message: null, exitToHome: !(error instanceof PackingApiError && error.status === 401) }); }
  private async readWithRetry(signal?: AbortSignal) {
    try { return await packingApi.get(this.roomId, signal); }
    catch (error) { if (!uncertain(error) || signal?.aborted) throw error; return packingApi.get(this.roomId, signal); }
  }
  /** Signals arriving during a write are satisfied by its single mandatory final read. */
  refresh = (manual = false): Promise<void> => {
    if (!this.active || this.busy) return Promise.resolve();
    if (this.reading) return this.reading;
    const generation = this.generation;
    this.reading = this.read(generation, manual).finally(() => { this.reading = null; });
    return this.reading;
  };
  private async read(generation: number, manual: boolean, preserveFailureMessage = false) {
    try {
      let data: PackingList;
      try {
        data = await this.client.fetchQuery({ queryKey: this.key, staleTime: 0, retry: false,
          queryFn: async ({ signal }) => {
            const result = await this.readWithRetry(signal);
            if (result.roomId !== this.roomId || result.ownerUserId !== this.userId) throw new PackingApiError(403, 'PACKING_SCOPE_MISMATCH', '준비물 접근 권한을 확인해 주세요.');
            if (this.state.data && result.version < this.state.data.version) throw new Error('stale packing version');
            return result;
          } });
      } catch (error) {
        if (!this.same(generation)) return;
        if (error instanceof PackingApiError && error.status === 404 && error.code === 'PACKING_LIST_NOT_INITIALIZED' && (!this.initAttempted || manual) && !this.state.data) {
          this.initAttempted = true;
          data = await packingApi.initialize(this.roomId);
        } else throw error;
      }
      if (!this.same(generation)) return;
      if (data.roomId !== this.roomId || data.ownerUserId !== this.userId) { this.revoke(); return; }
      if (this.state.data && data.version < this.state.data.version) {
        this.client.setQueryData(this.key, this.state.data);
        throw new Error('stale packing version');
      }
      this.setData(data);
      this.publish({ status: 'ready', message: preserveFailureMessage ? this.state.message : null });
    } catch (error) {
      if (!this.same(generation)) return;
      if (accessLost(error)) { this.revoke(error); return; }
      this.publish({ status: this.state.status === 'uncertain' ? 'uncertain' : this.state.data ? 'sync-error' : 'error',
        message: this.state.data ? '최신 내용을 확인하지 못했어요. 다시 동기화한 뒤 저장해 주세요.' : '준비물을 불러오지 못했어요. 다시 시도해 주세요.' });
    }
  }
  execute = (command: PackingCommand) => this.write(command);
  private optimistic(list: PackingList, command: Command): PackingList {
    if (command.type === 'renamePart') return { ...list, parts: list.parts.map(p => p.id === command.id ? { ...p, name: command.name.trim() } : p) };
    if (command.type === 'restoreItem') return { ...list, parts: list.parts.map(p => p.id === command.item.partId ? { ...p, items: [...p.items, command.item].sort((a,b) => a.position-b.position) } : p) };
    if (command.type === 'checkItem' || command.type === 'renameItem' || command.type === 'saveMemo' || command.type === 'deleteMemo') {
      return { ...list, parts: list.parts.map(p => ({ ...p, items: p.items.map(item => {
        if (item.id !== command.id) return item;
        if (command.type === 'checkItem') return { ...item, checked: command.checked };
        if (command.type === 'renameItem') return { ...item, name: command.name.trim() };
        if (command.type === 'deleteMemo') return { ...item, memo: null };
        const content = command.content.replace(/\r\n?/g, '\n').trim();
        return { ...item, memo: content ? { id: item.id, itemId: item.id, content } : null };
      }) })) };
    }
    // Creates wait for stable server IDs; deletes remain visible until acknowledged.
    return list;
  }
  private request(command: Command, version: number) {
    const r = this.roomId;
    switch (command.type) {
      case 'createPart': return packingApi.createPart(r, version, command.name);
      case 'renamePart': return packingApi.renamePart(r, command.id, version, command.name);
      case 'deletePart': return packingApi.deletePart(r, command.id, version, command.confirmed);
      case 'createItem': return packingApi.createItem(r, command.partId, version, command.name);
      case 'renameItem': return packingApi.renameItem(r, command.id, version, command.name);
      case 'checkItem': return packingApi.checkItem(r, command.id, version, command.checked);
      case 'deleteItem': return packingApi.deleteItem(r, command.id, version, command.confirmed);
      case 'restoreItem': return packingApi.restoreItem(r, command.id, version, command.undoToken);
      case 'saveMemo': return packingApi.saveMemo(r, command.id, version, command.content);
      case 'deleteMemo': return packingApi.deleteMemo(r, command.id, version);
    }
  }
  private async write(command: Command, expectedVersion?: number): Promise<PackingOutcome> {
    if (!this.active || this.busy || this.state.status !== 'ready' || !this.state.data) return { kind: 'blocked' };
    if (expectedVersion !== undefined && expectedVersion !== this.state.data.version) {
      this.publish({ confirmation: null, message: '내용이 변경됐어요. 다시 확인해 주세요.' }); return { kind: 'error' };
    }
    try {
      assertPackingVersion(this.state.data.version);
      if ('id' in command) assertPackingId(command.id);
      if ('partId' in command) assertPackingId(command.partId);
      if ('name' in command) normalizePackingName(command.name, command.type === 'createPart' || command.type === 'renamePart' ? 'part' : 'item');
      if (command.type === 'checkItem') assertPackingChecked(command.checked);
      if (command.type === 'saveMemo') normalizePackingMemo(command.content);
    } catch (error) {
      this.publish({ message: error instanceof Error ? error.message : '입력 내용을 확인해 주세요.' });
      return { kind: 'error' };
    }
    this.busy = true;
    this.publish({ status: 'writing', message: null });
    const generation = this.generation;
    await this.client.cancelQueries({ queryKey: this.key, exact: true });
    if (this.reading) await this.reading;
    if (!this.same(generation) || !this.state.data) { this.busy = false; return { kind: 'blocked' }; }
    const snapshot = this.state.data;
    if (expectedVersion !== undefined && snapshot.version !== expectedVersion) {
      this.busy = false;
      this.publish({ status: 'ready', confirmation: null, message: '내용이 변경됐어요. 삭제를 다시 확인해 주세요.' });
      return { kind: 'error' };
    }
    this.publish({ status: 'writing' });
    this.setData(this.optimistic(snapshot, command));
    const started = performance.now();
    let outcome: PackingOutcome = { kind: 'error' };
    try {
      const result = await this.request(command, snapshot.version);
      if (!this.same(generation)) return { kind: 'blocked' };
      const current = this.state.data ?? snapshot;
      if (result.version < current.version) throw new Error('stale packing write response');
      let parts = current.parts;
      if ('part' in result) {
        const part: PackingPart = result.part;
        parts = parts.some(p => p.id === part.id) ? parts.map(p => p.id === part.id ? part : p) : [...parts, part];
        if (command.type === 'createPart') outcome.createdPartId = part.id;
      }
      if ('item' in result) {
        const item: PackingItem = result.item;
        parts = parts.map(p => p.id !== item.partId ? p : { ...p, items: p.items.some(i => i.id === item.id) ? p.items.map(i => i.id === item.id ? item : i) : [...p.items, item] });
      }
      if ('deletedPartId' in result) parts = parts.filter(p => p.id !== result.deletedPartId);
      if ('deletedItemId' in result) parts = parts.map(p => ({ ...p, items: p.items.filter(i => i.id !== result.deletedItemId) }));
      this.setData({ ...current, version: result.version, parts });
      this.publish({ confirmation: null });
      if ('undo' in result && result.undo && command.type === 'deleteItem' && !command.confirmed) {
        const item = findItem(snapshot, command.id);
        const remaining = Math.max(0, Math.min(10_000, Date.parse(result.undo.expiresAt) - Date.parse(result.serverTime)) - (performance.now() - started));
        if (item && remaining > 0) this.addUndo(item, result.undo.token, remaining);
      }
      if (command.type === 'restoreItem') this.dropUndo(command.id);
      outcome = { ...outcome, kind: 'success' };
      await this.read(generation, false);
      return outcome;
    } catch (error) {
      if (!this.same(generation)) return { kind: 'blocked' };
      if (accessLost(error)) { this.revoke(error); return { kind: 'error' }; }
      this.setData(snapshot);
      const isUncertain = uncertain(error);
      const targetMissing = error instanceof PackingApiError && error.status === 404;
      const needsRead = isUncertain || targetMissing || (error instanceof PackingApiError && [409,410].includes(error.status));
      if (command.type === 'restoreItem') this.dropUndo(command.id);
      this.publish({ status: isUncertain ? 'uncertain' : needsRead ? 'sync-error' : 'ready', confirmation: null,
        message: isUncertain ? '저장 결과를 확인할 수 없어요. 동기화 후 내용을 확인해 주세요.' : '저장하지 못했어요. 내용을 확인하고 다시 저장해 주세요.' });
      if (needsRead) await this.read(generation, false, true);
      if (error instanceof PackingApiError && error.code === 'PACKING_CONFIRMATION_REQUIRED') {
        this.publish({ message: '메모 또는 항목이 있어요. 삭제를 다시 눌러 최신 내용을 확인해 주세요.' });
      }
      return { kind: targetMissing ? 'missing' : 'error' };
    } finally { this.busy = false; }
  }
  prepareDelete = async (kind: 'part' | 'item', id: number): Promise<PackingOutcome> => {
    if (this.busy || this.state.status !== 'ready' || !this.state.data) return { kind: 'blocked' };
    let target = kind === 'part' ? this.state.data.parts.find(p => p.id === id) : findItem(this.state.data, id);
    if (!target) return { kind: 'missing' };
    const needsConfirmation = kind === 'part' ? (target as PackingPart).items.length > 0 : !!(target as PackingItem).memo;
    if (!needsConfirmation) return this.write({ type: kind === 'part' ? 'deletePart' : 'deleteItem', id, confirmed: false });
    // Hold the same coordinator lock while reading the exact confirmation snapshot.
    this.busy = true;
    this.publish({ status: 'writing', confirmation: null });
    await this.read(this.generation, false);
    this.busy = false;
    if (this.state.status !== 'ready' || !this.state.data) return { kind: 'error' };
    target = kind === 'part' ? this.state.data.parts.find(p => p.id === id) : findItem(this.state.data, id);
    if (!target) return { kind: 'missing' };
    this.publish({ confirmation: { kind, id, version: this.state.data.version, name: target.name } });
    return { kind: 'confirmation' };
  };
  cancelConfirmation = () => this.publish({ confirmation: null });
  confirmDelete = async (): Promise<PackingOutcome> => {
    const c = this.state.confirmation;
    if (!c) return { kind: 'blocked' };
    return this.write({ type: c.kind === 'part' ? 'deletePart' : 'deleteItem', id: c.id, confirmed: true }, c.version);
  };
  private publishUndo() {
    this.publish({ undo: [...this.undos].map(([id,u]) => ({ id, name: u.item.name, remainingMs: Math.max(0,u.deadline-performance.now()) })) });
  }
  private addUndo(item: PackingItem, token: string, remaining: number) {
    this.dropUndo(item.id);
    this.undos.set(item.id, { item, token, deadline: performance.now()+remaining, timer: setTimeout(() => this.dropUndo(item.id), remaining) });
    this.publishUndo();
  }
  private dropUndo(id: number) { const u=this.undos.get(id);if(u){clearTimeout(u.timer);this.undos.delete(id);this.publishUndo();} }
  restore = async (id: number): Promise<PackingOutcome> => {
    const undo = this.undos.get(id);
    if (!undo || performance.now() >= undo.deadline || !this.state.data?.parts.some(p => p.id === undo.item.partId)) { this.dropUndo(id); return { kind:'blocked' }; }
    return this.write({type:'restoreItem',id,undoToken:undo.token,item:undo.item});
  };
}

const coordinators = new WeakMap<QueryClient, Map<string, PackingCoordinator>>();
export function getPackingCoordinator(client: QueryClient, roomId: string, userId: number) {
  let entries=coordinators.get(client);if(!entries){entries=new Map();coordinators.set(client,entries);}
  const key=JSON.stringify(packingQueryKey(roomId,userId));
  let coordinator=entries.get(key);
  if(!coordinator){coordinator=new PackingCoordinator(client,roomId,userId);entries.set(key,coordinator);}
  return coordinator;
}
export function releasePackingCoordinator(client:QueryClient, roomId:string,userId:number,coordinator:PackingCoordinator){
  const entries=coordinators.get(client);const key=JSON.stringify(packingQueryKey(roomId,userId));
  if(entries?.get(key)===coordinator){coordinator.dispose();entries.delete(key);}
}
