// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { bookmarkCategoriesQueryKey, roomAllBookmarksQueryKey } from '@/lib/query-keys';
import { useAllRoomBookmarks, useBookmarkCategories, useDeleteBookmarkCategory } from './useRooms';
import { applyRoomBookmarkStompMessage } from '@/lib/stomp/bookmarks-dispatch';
const api = vi.hoisted(() => ({ get: vi.fn(), getAll: vi.fn(), deleteCategory: vi.fn() }));
vi.mock('@/lib/api/rooms', async importOriginal => ({...await importOriginal<object>(), getBookmarkCategories: api.get, getAllRoomBookmarks: api.getAll, deleteBookmarkCategory: api.deleteCategory}));
function Probe() { const query=useBookmarkCategories('room');return <p>{query.data?.[0]?.name}</p>; }
it('reuses folders on reentry but fetches changes broadcast while mounted or away', async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 api.get.mockResolvedValue([{id:1,name:'Original'}]);
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const host=document.createElement('div');const root=createRoot(host);
 const render=(visible:boolean)=>root.render(<QueryClientProvider client={client}>{visible && <Probe/>}</QueryClientProvider>);
 const broadcast=()=>applyRoomBookmarkStompMessage(client,JSON.stringify({roomId:'room',categoryId:1,bookmarkId:null,type:'CATEGORY_UPDATED',actorUserId:2}));
 try {
  await act(async()=>render(true));
  await act(async()=>render(false));
  await act(async()=>render(true));
  expect(api.get).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValue([{id:1,name:'Updated'}]);
  await act(async()=>broadcast());
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(bookmarkCategoriesQueryKey('room'))).toEqual([{id:1,name:'Updated'}]);
  await act(async()=>render(false));
  await broadcast();
  expect(api.get).toHaveBeenCalledTimes(2);
  await act(async()=>render(true));
  expect(api.get).toHaveBeenCalledTimes(3);
 } finally {await act(async()=>root.unmount());client.clear();vi.unstubAllGlobals();}
});

function renderHooks<T>(client: QueryClient, useValue: () => T) {
 const result = { current: undefined as T };
 const capture = (value: T) => { result.current = value; };
 function Probe({ onRender }: { onRender: (value: T) => void }) { onRender(useValue()); return null; }
 const host = document.createElement('div');
 const root = createRoot(host);
 return {
  result,
  mount: () => act(async () => root.render(<QueryClientProvider client={client}><Probe onRender={capture} /></QueryClientProvider>)),
  unmount: () => act(async () => root.unmount()),
 };
}

it('폴더를 지우면 폴더 목록과 그 안의 북마크가 빠진 뒤에 끝난다', async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 api.get.mockResolvedValue([{ categoryId: 1, name: '맛집', placeCount: 1 }, { categoryId: 2, name: '카페', placeCount: 0 }]);
 api.getAll.mockResolvedValue([{ bookmarkId: 10, categoryId: 1 }]);
 api.deleteCategory.mockResolvedValue(undefined);
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 const view = renderHooks(client, () => ({
  categories: useBookmarkCategories('room'),
  bookmarks: useAllRoomBookmarks('room'),
  remove: useDeleteBookmarkCategory(),
 }));
 try {
  await view.mount();
  await vi.waitFor(() => expect(view.result.current.bookmarks.data).toHaveLength(1));
  api.get.mockResolvedValue([{ categoryId: 2, name: '카페', placeCount: 0 }]);
  api.getAll.mockResolvedValue([]);

  await act(async () => { await view.result.current.remove.mutateAsync({ roomId: 'room', categoryId: 1 }); });

  // 본인 CATEGORY_DELETED는 STOMP에서 버리므로 mutation이 두 목록을 다시 받고, 받은 뒤에 끝난다
  expect(client.getQueryData(bookmarkCategoriesQueryKey('room'))).toEqual([{ categoryId: 2, name: '카페', placeCount: 0 }]);
  expect(client.getQueryData(roomAllBookmarksQueryKey('room'))).toEqual([]);
 } finally { await view.unmount(); client.clear(); vi.unstubAllGlobals(); }
});
