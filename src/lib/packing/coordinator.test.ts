import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PackingCoordinator } from './coordinator';
import { PackingApiError, packingApi } from '@/lib/api/rooms/packing';
import type { PackingList } from './types';
vi.mock('@/lib/api/rooms/packing', () => ({
  PackingApiError: class extends Error { constructor(public status:number,public code:string,message:string){super(message);} },
  packingApi: { get:vi.fn(),initialize:vi.fn(),createPart:vi.fn(),renamePart:vi.fn(),deletePart:vi.fn(),createItem:vi.fn(),renameItem:vi.fn(),checkItem:vi.fn(),deleteItem:vi.fn(),saveMemo:vi.fn(),deleteMemo:vi.fn() },
}));
const room='11111111-1111-4111-8111-111111111111';
function list(version=0):PackingList { return {id:1,roomId:room,ownerUserId:7,version,initializedAt:'2026-09-20T00:00:00Z',parts:[{id:2,name:'서류',position:0,column:0,items:[{id:3,partId:2,name:'여권',checked:false,position:0,memo:null,tips:[]}]}]}; }
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const c=new PackingCoordinator(client,room,7);return {client,c};}
function deferred<T>(){let resolve!:(x:T)=>void;let reject!:(x:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
afterEach(()=>{vi.resetAllMocks();vi.useRealTimers();});
describe('packing admission and recovery',()=>{
 it('deduplicates admission and initializes only exact not-initialized, retaining empty list',async()=>{
  const {c}=setup();vi.mocked(packingApi.get).mockRejectedValue(new PackingApiError(404,'PACKING_LIST_NOT_INITIALIZED','missing'));
  vi.mocked(packingApi.initialize).mockResolvedValue({...list(),parts:[]});
  await Promise.all([c.refresh(),c.refresh(),c.refresh()]);
  expect(packingApi.get).toHaveBeenCalledTimes(1);expect(packingApi.initialize).toHaveBeenCalledTimes(1);expect(c.getSnapshot().data?.parts).toEqual([]);
  vi.mocked(packingApi.get).mockResolvedValue({...list(),parts:[]});await c.refresh();expect(packingApi.initialize).toHaveBeenCalledTimes(1);
 });
 it.each([[404,'UNKNOWN'],[403,'NOT_ROOM_MEMBER'],[404,'ROOM_NOT_FOUND'],[429,'TOO_MANY_REQUESTS']])('never initializes arbitrary %i %s',async(status,code)=>{const {c}=setup();vi.mocked(packingApi.get).mockRejectedValue(new PackingApiError(status,code,'error'));await c.refresh();expect(packingApi.initialize).not.toHaveBeenCalled();expect(packingApi.get).toHaveBeenCalledTimes(1);});
 it('retries network GET once but never loops initialization after its failure',async()=>{const {c}=setup();vi.mocked(packingApi.get).mockRejectedValue(new TypeError('offline'));await c.refresh();expect(packingApi.get).toHaveBeenCalledTimes(2);expect(c.getSnapshot().status).toBe('error');
 vi.mocked(packingApi.get).mockRejectedValue(new PackingApiError(404,'PACKING_LIST_NOT_INITIALIZED','missing'));vi.mocked(packingApi.initialize).mockRejectedValue(new TypeError('offline'));await c.refresh();await c.refresh();expect(packingApi.initialize).toHaveBeenCalledTimes(1);await c.refresh(true);expect(packingApi.initialize).toHaveBeenCalledTimes(2);});
 it('locks synchronously, optimistically checks, defers focus reads and applies server entity/version',async()=>{const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();const pending=deferred<Awaited<ReturnType<typeof packingApi.checkItem>>>();vi.mocked(packingApi.checkItem).mockReturnValue(pending.promise);
 const first=c.execute({type:'checkItem',id:3,checked:true});const second=await c.execute({type:'checkItem',id:3,checked:false});expect(second.kind).toBe('blocked');await Promise.resolve();await c.refresh();expect(packingApi.get).toHaveBeenCalledTimes(1);
 pending.resolve({version:1,item:{...list().parts[0].items[0],checked:true}});vi.mocked(packingApi.get).mockResolvedValue({...list(1),parts:[{...list().parts[0],items:[{...list().parts[0].items[0],checked:true}]}]});await first;expect(packingApi.checkItem).toHaveBeenCalledTimes(1);expect(c.getSnapshot().data?.version).toBe(1);expect(c.getSnapshot().data?.parts[0].items[0].checked).toBe(true);expect(packingApi.get).toHaveBeenCalledTimes(2);
 });
 it('keeps a confirmed write when follow-up GET fails and blocks writes until recovery',async()=>{const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();vi.mocked(packingApi.checkItem).mockResolvedValue({version:1,item:{...list().parts[0].items[0],checked:true}});vi.mocked(packingApi.get).mockRejectedValue(new TypeError('offline'));expect((await c.execute({type:'checkItem',id:3,checked:true})).kind).toBe('success');expect(c.getSnapshot().status).toBe('sync-error');expect(c.getSnapshot().data?.parts[0].items[0].checked).toBe(true);expect((await c.execute({type:'renamePart',id:2,name:'new'})).kind).toBe('blocked');vi.mocked(packingApi.get).mockResolvedValue(list(1));await c.refresh(true);expect(c.getSnapshot().status).toBe('ready');expect(c.getSnapshot().message).toBeNull();});
 it('rolls back uncertain writes, never retries them, reconciles and requires explicit resave',async()=>{const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();vi.mocked(packingApi.checkItem).mockRejectedValue(new TypeError('lost response'));vi.mocked(packingApi.get).mockRejectedValue(new TypeError('offline'));await c.execute({type:'checkItem',id:3,checked:true});expect(c.getSnapshot().data?.parts[0].items[0].checked).toBe(false);expect(c.getSnapshot().status).toBe('uncertain');expect(packingApi.checkItem).toHaveBeenCalledTimes(1);expect((await c.execute({type:'checkItem',id:3,checked:true})).kind).toBe('blocked');});
 it.each([400,409,410,429])('rolls back definite %i with no mutation retry',async(status)=>{const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();vi.mocked(packingApi.checkItem).mockRejectedValue(new PackingApiError(status,'PACKING_CONFLICT','retry explicitly'));await c.execute({type:'checkItem',id:3,checked:true});expect(c.getSnapshot().data?.parts[0].items[0].checked).toBe(false);expect(packingApi.checkItem).toHaveBeenCalledTimes(1);});
 it('invalidates pending generation and removes cache on scope loss',async()=>{const {c,client}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();const pending=deferred<Awaited<ReturnType<typeof packingApi.checkItem>>>();vi.mocked(packingApi.checkItem).mockReturnValue(pending.promise);const write=c.execute({type:'checkItem',id:3,checked:true});await Promise.resolve();await Promise.resolve();c.dispose();pending.resolve({version:1,item:{...list().parts[0].items[0],checked:true}});await write;expect(c.getSnapshot().data).toBeNull();expect(client.getQueryData(['packing',room,7])).toBeUndefined();});
 it('rejects data for another principal and purges cached private content on access loss',async()=>{const {c,client}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();vi.mocked(packingApi.get).mockRejectedValue(new PackingApiError(403,'NOT_ROOM_MEMBER','gone'));await c.refresh();expect(c.getSnapshot().status).toBe('revoked');expect(c.getSnapshot().data).toBeNull();expect(client.getQueryData(['packing',room,7])).toBeUndefined();});
 it('does not lower committed version with a stale read',async()=>{const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list(4));await c.refresh();vi.mocked(packingApi.get).mockResolvedValue(list(2));await c.refresh();expect(c.getSnapshot().data?.version).toBe(4);expect(c.getSnapshot().status).toBe('sync-error');});
 it('refetches before nonempty delete confirmation; cancel sends no DELETE',async()=>{const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();await c.prepareDelete('part',2);expect(packingApi.get).toHaveBeenCalledTimes(2);expect(c.getSnapshot().confirmation).toMatchObject({kind:'part',id:2,version:0});c.cancelConfirmation();expect(packingApi.deletePart).not.toHaveBeenCalled();});
 it('requires confirmation for a memo-free item and deletes immediately after approval',async()=>{
  const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();
  await c.prepareDelete('item',3);
  expect(c.getSnapshot().confirmation).toMatchObject({kind:'item',id:3,version:0});
  expect(packingApi.deleteItem).not.toHaveBeenCalled();
  const pending=deferred<Awaited<ReturnType<typeof packingApi.deleteItem>>>();vi.mocked(packingApi.deleteItem).mockReturnValue(pending.promise);
  const deletion=c.confirmDelete();await Promise.resolve();await Promise.resolve();
  expect(c.getSnapshot().data?.parts[0].items).toHaveLength(1);
  pending.resolve({version:1,deletedItemId:3});
  vi.mocked(packingApi.get).mockResolvedValue({...list(1),parts:[{...list().parts[0],items:[]}]});
  await deletion;
  expect(packingApi.deleteItem).toHaveBeenCalledExactlyOnceWith(room,3,0,true);
  expect(c.getSnapshot().data?.parts[0].items).toEqual([]);
 });
});

it('does not send a confirmation after a read advances its reviewed version while cancellation settles',async()=>{
 const {c,client}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();await c.prepareDelete('part',2);
 const read=deferred<PackingList>();vi.mocked(packingApi.get).mockReturnValue(read.promise);const refresh=c.refresh();
 const cancelled=deferred<void>();vi.spyOn(client,'cancelQueries').mockReturnValue(cancelled.promise);
 const confirmation=c.confirmDelete();read.resolve(list(1));await refresh;cancelled.resolve();await confirmation;
 expect(packingApi.deletePart).not.toHaveBeenCalled();expect(c.getSnapshot().confirmation).toBeNull();expect(c.getSnapshot().status).toBe('ready');
});
it('never publishes another owner response into the admitted query cache',async()=>{
 const {c,client}=setup();const seen:unknown[]=[];client.getQueryCache().subscribe(()=>{const d=client.getQueryData<PackingList>(['packing',room,7]);if(d)seen.push(d.ownerUserId);});
 vi.mocked(packingApi.get).mockResolvedValue({...list(),ownerUserId:8});await c.refresh();expect(seen).not.toContain(8);expect(c.getSnapshot().status).toBe('revoked');
});
it('rejects invalid local drafts without speculative display or recovery request',async()=>{
 const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();await c.execute({type:'renamePart',id:2,name:' '.repeat(51)});
 expect(packingApi.renamePart).not.toHaveBeenCalled();expect(packingApi.get).toHaveBeenCalledTimes(1);expect(c.getSnapshot().status).toBe('ready');expect(c.getSnapshot().data?.parts[0].name).toBe('서류');
});
it('leaves final 401 navigation to existing session teardown',async()=>{const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();vi.mocked(packingApi.get).mockRejectedValue(new PackingApiError(401,'UNAUTHORIZED','expired'));await c.refresh();expect(c.getSnapshot().status).toBe('revoked');expect(c.getSnapshot().exitToHome).toBe(false);});
it('ignores late initialization after scope disposal',async()=>{const {c,client}=setup();vi.mocked(packingApi.get).mockRejectedValue(new PackingApiError(404,'PACKING_LIST_NOT_INITIALIZED','missing'));const init=deferred<PackingList>();vi.mocked(packingApi.initialize).mockReturnValue(init.promise);const admission=c.refresh();await Promise.resolve();await Promise.resolve();await Promise.resolve();c.dispose();init.resolve(list());await admission;expect(c.getSnapshot().data).toBeNull();expect(client.getQueryData(['packing',room,7])).toBeUndefined();});
it('a changed version invalidates an open item delete confirmation',async()=>{
 const {c}=setup();vi.mocked(packingApi.get).mockResolvedValue(list());await c.refresh();await c.prepareDelete('item',3);
 vi.mocked(packingApi.get).mockResolvedValue(list(1));await c.refresh();
 await c.confirmDelete();expect(packingApi.deleteItem).not.toHaveBeenCalled();expect(c.getSnapshot().confirmation).toBeNull();
});

it('does not publish a sync failure when a write cancels an in-flight refresh', async () => {
 const {c,client}=setup();
 vi.mocked(packingApi.get).mockResolvedValue(list());
 await c.refresh();
 const read=deferred<PackingList>();
 vi.mocked(packingApi.get).mockReturnValueOnce(read.promise);
 const refresh=c.refresh();
 const pending=deferred<Awaited<ReturnType<typeof packingApi.checkItem>>>();
 vi.mocked(packingApi.checkItem).mockReturnValueOnce(pending.promise);
 const failures:string[]=[];
 const unsubscribe=c.subscribe(()=>{const state=c.getSnapshot();if(state.message)failures.push(state.message);});
 const write=c.execute({type:'checkItem',id:3,checked:true});
 await refresh;
 await vi.waitFor(()=>expect(c.getSnapshot().data?.parts[0].items[0].checked).toBe(true));
 expect(c.getSnapshot().status).toBe('writing');
 expect(c.getSnapshot().message).toBeNull();
 expect(failures).toEqual([]);
 read.resolve(list());
 const updated={...list(1),parts:[{...list().parts[0],items:[{...list().parts[0].items[0],checked:true}]}]};
 vi.mocked(packingApi.get).mockResolvedValue(updated);
 pending.resolve({version:1,item:updated.parts[0].items[0]});
 await write;
 expect(c.getSnapshot().status).toBe('ready');
 expect(c.getSnapshot().message).toBeNull();
 unsubscribe();c.dispose();client.clear();
});
