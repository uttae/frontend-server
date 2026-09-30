"use client";

import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useSessionUser } from '@/hooks/useSessionUser';
import { useSessionStore } from '@/stores/session-store';
import { sessionUserQueryKey } from '@/lib/query-keys';
import { isPackingPath, parseRoomContextPath } from '@/lib/room-context-path';
import { getPackingCoordinator, releasePackingCoordinator, type PackingCoordinator, type PackingState } from '@/lib/packing/coordinator';

const empty: PackingState = {data:null,status:'loading',message:null,confirmation:null};
const emptySnapshot = () => empty;
const emptySubscribe = () => () => {};
const guarded = new WeakSet<PackingCoordinator>();

// The private list belongs to the room/session, not the lifetime of its tab.
// Keep guards subscribed while the tab is absent, so logout still purges immediately.
function guardScope(client: QueryClient, coordinator: PackingCoordinator, roomId: string, userId: number) {
  if (guarded.has(coordinator)) return;
  guarded.add(coordinator);
  const release = () => {
    unsubscribeSession();
    unsubscribeQuery();
    guarded.delete(coordinator);
    releasePackingCoordinator(client, roomId, userId, coordinator);
  };
  const unsubscribeSession = useSessionStore.subscribe(session => {
    if (!session.sessionReady || session.currentRoomId !== roomId) release();
  });
  const unsubscribeQuery = client.getQueryCache().subscribe(event => {
    const key = event.query.queryKey;
    if (JSON.stringify(key) === JSON.stringify(sessionUserQueryKey)) {
      const user = event.query.state.data as { id?: number } | undefined;
      if (event.type === 'removed' || user?.id !== userId) release();
    }
  });
}

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
    guardScope(client,coordinator,roomId,userId);
    return () => coordinator.cancelConfirmation();
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
