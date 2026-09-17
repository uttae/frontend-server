"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useScheduleItemSaving, useUpdateScheduleItem } from "./useRooms";
import { HttpError } from "@/lib/api/errors";
import { isMemoVersion } from "@/lib/plan/memo-version";
import { refreshMemoConflict } from "@/lib/plan/memo-save";

export type MemoSnapshot = { memo?: string; memoVersion?: number };
export function useMemoSave(roomId: string, scheduleId: number, itemId: number) {
  const qc = useQueryClient();
  const mutation = useUpdateScheduleItem();
  const sharedPending = useScheduleItemSaving(roomId, scheduleId, itemId);
  const lock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<MemoSnapshot | null>(null);
  const unavailable = (e: unknown) => e instanceof HttpError && [401, 403, 404].includes(e.status);

  async function refresh() {
    if (blocked) return;
    setRefreshing(true);
    setNeedsRefresh(true);
    try {
      const latest = await refreshMemoConflict(qc, { roomId, scheduleId, itemId });
      if (!isMemoVersion(latest.memoVersion)) throw new Error("메모 버전을 확인할 수 없어요.");
      setConflict(latest);
      setNeedsRefresh(false);
      setError("다른 멤버가 메모를 변경했어요. 최신 내용을 확인하고 다시 저장해 주세요.");
    } catch (e) {
      if (unavailable(e)) setBlocked(true);
      setError(e instanceof Error ? e.message : "최신 메모를 불러오지 못했어요.");
    } finally { setRefreshing(false); }
  }

  async function save(memo: string, expectedMemoVersion: number | undefined) {
    if (lock.current || sharedPending || blocked || needsRefresh || !isMemoVersion(expectedMemoVersion)) return false;
    lock.current = true;
    setError("");
    try {
      const updated = await mutation.mutateAsync({ roomId, scheduleId, itemId, body: { memo, expectedMemoVersion } });
      if (!isMemoVersion(updated.memoVersion)) {
        setBlocked(true);
        setError("저장 응답의 메모 버전을 확인할 수 없어요. 초안을 보관해 주세요.");
        return false;
      }
      setConflict(null);
      return true;
    } catch (e) {
      if (e instanceof HttpError && e.status === 409 && e.code === "SCHEDULE_MEMO_CONFLICT") {
        await refresh();
      } else {
        if (unavailable(e)) setBlocked(true);
        setError(e instanceof Error ? e.message : "메모를 저장하지 못했어요.");
      }
      return false;
    } finally { lock.current = false; }
  }
  return { save, refresh, conflict, setConflict, blocked, needsRefresh, error, isPending: mutation.isPending || sharedPending || refreshing };
}
