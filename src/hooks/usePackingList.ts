"use client";

import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useSessionStore } from '@/stores/session-store';
import { isPackingPath, parseRoomContextPath } from '@/lib/room-context-path';
import { getPackingCoordinator, releasePackingCoordinator, type PackingCoordinator, type PackingState } from '@/lib/packing/coordinator';

const empty: PackingState = {data:null,status:'loading',message:null,confirmation:null,undo:[]};
const emptySnapshot = () => empty;
const emptySubscribe = () => () => {};
const leases = new WeakMap<PackingCoordinator, number>();

export function usePackingList() {
  const pathname=usePathname();
  const router=useRouter();
  const client=useQueryClient();
  const {data:user}=useSessionUser();
  const sessionReady=useSessionStore(s=>s.sessionReady);
  const currentRoomId=useSessionStore(s=>s.currentRoomId);
  const route=parseRoomContextPath(pathname);
  const roomId=isPackingPath(pathname) && !route.invalidPackingPath ? route.roomId : null;
  const userId=user?.id;
  const enabled=!!roomId && sessionReady && Number.isSafeInteger(userId) && (userId ?? 0)>0 && currentRoomId===roomId;
  const coordinator=useMemo(()=>enabled && roomId && userId ? getPackingCoordinator(client,roomId,userId) : null,[client,enabled,roomId,userId]);
  const state=useSyncExternalStore(coordinator?.subscribe ?? emptySubscribe,coordinator?.getSnapshot ?? emptySnapshot,emptySnapshot);
  useLayoutEffect(()=>{
    if(!coordinator || !roomId || !userId) return;
    leases.set(coordinator,(leases.get(coordinator) ?? 0)+1);
    const unsubscribe = useSessionStore.subscribe(session => {
      if (!session.sessionReady || session.currentRoomId !== roomId) releasePackingCoordinator(client,roomId,userId,coordinator);
    });
    return ()=>{
      unsubscribe();
      leases.set(coordinator,(leases.get(coordinator) ?? 1)-1);
      // StrictMode tears down and reattaches effects synchronously. Keep its one admission.
      queueMicrotask(()=>{if(leases.get(coordinator)===0) {releasePackingCoordinator(client,roomId,userId,coordinator);leases.delete(coordinator);}});
    };
  },[client,coordinator,roomId,userId]);
  useEffect(()=>{
    if(!coordinator) return;
    void coordinator.refresh();
    const refresh=()=>{if(document.visibilityState==='visible') void coordinator.refresh();};
    window.addEventListener('focus',refresh);
    window.addEventListener('online',refresh);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[coordinator]);
  useEffect(()=>{
    if(state.status!=='revoked' || state.exitToHome === false) return;
    useSessionStore.getState().clearCurrentRoomId();
    router.replace('/home');
  },[router,state.status,state.exitToHome]);
  return {state,coordinator,scopeKey:enabled ? `${roomId}:${userId}` : `inactive:${pathname}:${userId ?? ''}`};
}
