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
it('admits StrictMode once, coalesces visible/focus/online, and purges on route change',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.get.mockResolvedValue(response);useSessionStore.setState({sessionReady:true,currentRoomId:room});
 const client=new QueryClient();client.setQueryData(sessionUserQueryKey,{id:7});const host=document.createElement('div');const root=createRoot(host);
 try{await act(async()=>root.render(<StrictMode><QueryClientProvider client={client}><Probe/></QueryClientProvider></StrictMode>));expect(host.textContent).toBe(room);expect(mocks.get).toHaveBeenCalledTimes(1);
 await act(async()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));});expect(mocks.get).toHaveBeenCalledTimes(2);
 mocks.pathname='/packing/bad';await act(async()=>root.render(<StrictMode><QueryClientProvider client={client}><Probe/></QueryClientProvider></StrictMode>));expect(host.textContent).toBe('loading');expect(client.getQueryData(['packing',room,7])).toBeUndefined();expect(mocks.get).toHaveBeenCalledTimes(2);
 }finally{await act(async()=>root.unmount());client.clear();}
});
it('does not query while explicit route and session room disagree',async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);useSessionStore.setState({sessionReady:true,currentRoomId:'stale'});const client=new QueryClient();const root=createRoot(document.createElement('div'));try{await act(async()=>root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));expect(mocks.get).not.toHaveBeenCalled();expect(latest.coordinator).toBeNull();}finally{await act(async()=>root.unmount());client.clear();}});
it('purges cached private data synchronously when session readiness is lost',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.get.mockResolvedValue(response);useSessionStore.setState({sessionReady:true,currentRoomId:room});const client=new QueryClient();const root=createRoot(document.createElement('div'));
 try{await act(async()=>root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));expect(client.getQueryData(['packing',room,7])).toBeDefined();await act(async()=>{useSessionStore.setState({sessionReady:false});expect(client.getQueryData(['packing',room,7])).toBeUndefined();});}finally{await act(async()=>root.unmount());client.clear();}
});
