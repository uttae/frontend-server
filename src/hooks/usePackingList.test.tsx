// @vitest-environment jsdom
import { act, StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { usePackingList } from './usePackingList';
import { useSessionStore } from '@/stores/session-store';
import { sessionUserQueryKey } from '@/lib/query-keys';
const mocks=vi.hoisted(()=>({pathname:'/packing/11111111-1111-4111-8111-111111111111',replace:vi.fn(),get:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>mocks.pathname,useRouter:()=>({replace:mocks.replace})}));
vi.mock('@/lib/api/rooms/packing',()=>({PackingApiError:class extends Error{},packingApi:{get:mocks.get}}));
vi.mock('@/hooks/useSessionUser',()=>({useSessionUser:()=>({data:{id:7}})}));
const room='11111111-1111-4111-8111-111111111111';
const response={id:1,roomId:room,ownerUserId:7,version:0,initializedAt:'2026-09-20T00:00:00Z',parts:[]};
let latest:ReturnType<typeof usePackingList>;
function Probe(){const value=usePackingList();useLayoutEffect(()=>{latest=value;},[value]);return <p>{value.state.data?.roomId ?? 'loading'}</p>;}
afterEach(()=>{vi.resetAllMocks();vi.unstubAllGlobals();useSessionStore.setState({sessionReady:false,currentRoomId:null});mocks.pathname=`/packing/${room}`;});
it('admits StrictMode once, ignores visible/focus/online with a ready list, and hides the list on an invalid route',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.get.mockResolvedValue(response);useSessionStore.setState({sessionReady:true,currentRoomId:room});
 const client=new QueryClient();client.setQueryData(sessionUserQueryKey,{id:7});const host=document.createElement('div');const root=createRoot(host);
 try{await act(async()=>root.render(<StrictMode><QueryClientProvider client={client}><Probe/></QueryClientProvider></StrictMode>));expect(host.textContent).toBe(room);expect(mocks.get).toHaveBeenCalledTimes(1);
 await act(async()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));});expect(mocks.get).toHaveBeenCalledTimes(1);
 mocks.pathname='/packing/bad';await act(async()=>root.render(<StrictMode><QueryClientProvider client={client}><Probe/></QueryClientProvider></StrictMode>));expect(host.textContent).toBe('loading');expect(latest.coordinator).toBeNull();expect(mocks.get).toHaveBeenCalledTimes(1);
 }finally{await act(async()=>root.unmount());client.clear();}
});
it('does not query while explicit route and session room disagree',async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);useSessionStore.setState({sessionReady:true,currentRoomId:'stale'});const client=new QueryClient();const root=createRoot(document.createElement('div'));try{await act(async()=>root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));expect(mocks.get).not.toHaveBeenCalled();expect(latest.coordinator).toBeNull();}finally{await act(async()=>root.unmount());client.clear();}});
it('purges cached private data synchronously when session readiness is lost',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.get.mockResolvedValue(response);useSessionStore.setState({sessionReady:true,currentRoomId:room});const client=new QueryClient();const root=createRoot(document.createElement('div'));
 try{await act(async()=>root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));expect(client.getQueryData(['packing',room,7])).toBeDefined();await act(async()=>{useSessionStore.setState({sessionReady:false});expect(client.getQueryData(['packing',room,7])).toBeUndefined();});}finally{await act(async()=>root.unmount());client.clear();}
});

it('reuses the list on tab reentry without fetching and purges it after logout off-tab', async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 mocks.get.mockResolvedValue(response);
 useSessionStore.setState({sessionReady:true,currentRoomId:room});
 const client=new QueryClient();client.setQueryData(sessionUserQueryKey,{id:7});
 const host=document.createElement('div');const root=createRoot(host);
 const render=(visible:boolean)=>root.render(<QueryClientProvider client={client}>{visible && <Probe/>}</QueryClientProvider>);
 try {
  await act(async()=>render(true));
  const original=latest.coordinator;
  await act(async()=>render(false));
  await act(async()=>render(true));
  expect(host.textContent).toBe(room);
  expect(latest.coordinator).toBe(original);
  expect(mocks.get).toHaveBeenCalledTimes(1);
  mocks.get.mockResolvedValue({...response,version:1});
  await act(async()=>latest.coordinator?.refresh(true));
  expect(latest.state.data?.version).toBe(1);
  await act(async()=>render(false));
  useSessionStore.setState({sessionReady:false});
  expect(client.getQueryData(['packing',room,7])).toBeUndefined();
  expect(original?.getSnapshot().data).toBeNull();
 } finally {await act(async()=>root.unmount());client.clear();}
});

it.each(['room', 'principal', 'cache'])('purges a retained off-tab list on %s changes', async (change) => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.get.mockResolvedValue(response);
 useSessionStore.setState({sessionReady:true,currentRoomId:room});
 const client=new QueryClient();client.setQueryData(sessionUserQueryKey,{id:7});
 const root=createRoot(document.createElement('div'));
 try {
  await act(async()=>root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));
  const coordinator=latest.coordinator;
  await act(async()=>root.unmount());
  if(change==='room') useSessionStore.setState({currentRoomId:'another-room'});
  else if(change==='principal') client.setQueryData(sessionUserQueryKey,{id:8});
  else client.clear();
  expect(coordinator?.getSnapshot().data).toBeNull();
  expect(client.getQueryData(['packing',room,7])).toBeUndefined();
 } finally {client.clear();}
});

it('retries an unsuccessful initial read when connectivity returns', async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 useSessionStore.setState({sessionReady:true,currentRoomId:room});
 mocks.get.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response);
 const client=new QueryClient();const root=createRoot(document.createElement('div'));
 try {
  await act(async()=>root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));
  expect(latest.state.status).toBe('error');
  await act(async()=>window.dispatchEvent(new Event('online')));
  expect(latest.state.data?.roomId).toBe(room);
  expect(latest.state.status).toBe('ready');
 } finally {await act(async()=>root.unmount());client.clear();}
});
