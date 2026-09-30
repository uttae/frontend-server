// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { bookmarkCategoriesQueryKey } from '@/lib/query-keys';
import { useBookmarkCategories } from './useRooms';
import { applyRoomBookmarkStompMessage } from '@/lib/stomp/bookmarks-dispatch';
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api/rooms', async importOriginal => ({...await importOriginal<object>(), getBookmarkCategories: api.get}));
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
