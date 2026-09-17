"use client";

import { Trash2 } from "lucide-react";

import { MemoIcon } from "@/components/icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMemoSave, type MemoSnapshot } from "@/hooks/useMemoSave";
import { isMemoVersion } from "@/lib/plan/memo-version";
import { memoDraftKey, usePlanMemoDraftsStore } from "@/stores/plan-memo-drafts-store";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import { MemoMarkdown } from "./MemoMarkdown";
import { cn } from "@/lib/utils";

const SCHEDULE_ITEM_MEMO_MAX_LENGTH = 2000;


type PlanItemMemoEditorProps = {
  roomId: string;
  scheduleId: number;
  itemId: number;
  memo?: string;
  memoVersion?: number;
  onClose: () => void;
};

function stopCardActivation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function MemoOverwriteConfirmDialog({
  open,
  isPending,
  onCancel,
  onConfirm,
  latest,
}: {
  open: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  latest: MemoSnapshot | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="memo-overwrite-dialog-title"
        aria-describedby="memo-overwrite-dialog-desc"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-gray-border bg-white p-5 shadow-lg"
      >
        <h2 id="memo-overwrite-dialog-title" className="text-base font-semibold text-gray-900">
          다른 사람의 입력을 덮어씁니다!
        </h2>
        <p id="memo-overwrite-dialog-desc" className="mt-2 text-sm leading-relaxed text-dark-gray">
          다른 멤버가 메모를 수정했어요. 저장하면 그 내용 대신 지금 작성 중인 메모로 바뀝니다.
        </p>
        <div className="mt-3 max-h-48 overflow-auto rounded border border-gray-border p-2" aria-label="최신 메모"><MemoMarkdown memo={latest?.memo || "(빈 메모)"} /></div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="cursor-pointer rounded-md border border-gray-border px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "저장 중…" : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlanItemMemoReadOnly({
  memo,
  onDelete,
  isDeleting = false,
  onToggle,
}: {
  memo: string;
  onDelete?: () => void;
  isDeleting?: boolean;
  onToggle?: (next: string) => void;
}) {
  const text = memo.trim();
  if (!text.length) return null;

  return (
    <div className={PLAN_PLACE_CARD_TW.editorModule}>
      <div className={PLAN_PLACE_CARD_TW.editorSideLabelWrapper}>
        <MemoIcon className="h-6 w-6" />
      </div>
      <MemoMarkdown memo={memo} onToggle={onToggle} disabled={isDeleting} />
      {onDelete ? (
        <button
          type="button"
          aria-label="메모 삭제"
          disabled={isDeleting}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 cursor-pointer self-start rounded-md p-1 text-dark-gray transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function PlanItemMemoEditor({ roomId, scheduleId, itemId, memo, memoVersion, onClose }: PlanItemMemoEditorProps) {
  const key = memoDraftKey(roomId, scheduleId, itemId);
  const [initial] = useState(() => usePlanMemoDraftsStore.getState().drafts[key]);
  const [baseMemo, setBaseMemo] = useState(initial?.baseMemo ?? memo ?? "");
  const [baseVersion, setBaseVersion] = useState(
    initial ? initial.baseVersion : memoVersion,
  );
  const [draft, setDraft] = useState(initial?.draft ?? memo ?? "");
  const [reviewed, setReviewed] = useState<MemoSnapshot | null>(null);
  const saving = useMemoSave(roomId, scheduleId, itemId);
  const dirty = draft !== baseMemo;

  /* eslint-disable react-hooks/set-state-in-effect -- clean editors follow a newer server snapshot. */
  useEffect(() => {
    if (dirty || initial) return;
    const incomingMemo = memo ?? "";
    if (incomingMemo === baseMemo && memoVersion === baseVersion) return;
    setDraft(incomingMemo);
    setBaseMemo(incomingMemo);
    setBaseVersion(memoVersion);
  }, [baseMemo, baseVersion, dirty, initial, memo, memoVersion]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (dirty) usePlanMemoDraftsStore.getState().put(key, { roomId, scheduleId, itemId, draft, baseMemo, baseVersion, active: true });
    else usePlanMemoDraftsStore.getState().remove(key);
  }, [key, roomId, scheduleId, itemId, draft, baseMemo, baseVersion, dirty]);
  useEffect(() => () => usePlanMemoDraftsStore.getState().deactivate(key), [key]);

  async function commit(version: number | undefined) {
    if (draft.length > SCHEDULE_ITEM_MEMO_MAX_LENGTH) return;
    if (await saving.save(draft.trim().length ? draft : "", version)) {
      usePlanMemoDraftsStore.getState().remove(key);
      toast.success("메모를 저장했어요.");
      onClose();
    }
    setReviewed(null);
  }
  function save() {
    const latest = saving.conflict ?? { memo, memoVersion };
    if (latest.memoVersion !== baseVersion) { setReviewed(latest); return; }
    void commit(baseVersion);
  }
  const disabled = saving.isPending || saving.blocked || saving.needsRefresh;
  return <>
    <div className={PLAN_PLACE_CARD_TW.editorModule} onMouseDown={stopCardActivation} onClick={stopCardActivation}>
      <div className={PLAN_PLACE_CARD_TW.editorSideLabelWrapper}><MemoIcon className="h-6 w-6" /></div>
      <div className={PLAN_PLACE_CARD_TW.editorBody}>
        <textarea aria-label="일정 메모" value={draft} maxLength={SCHEDULE_ITEM_MEMO_MAX_LENGTH} rows={4}
          placeholder="여기에 메모를 작성하세요" disabled={saving.isPending}
          onChange={(e) => setDraft(e.target.value)} className={cn(PLAN_PLACE_CARD_TW.memoTextarea, "select-text cursor-text")} />
        <MemoSaveNotice saving={saving} />
        {!isMemoVersion(baseVersion) && <p role="alert">메모 버전을 확인할 수 없어 저장할 수 없어요. 초안을 보관해 주세요.</p>}
        <div className={PLAN_PLACE_CARD_TW.editorFooterRow}>
          <button type="button" disabled={disabled || draft.length + 7 > SCHEDULE_ITEM_MEMO_MAX_LENGTH} onClick={() => setDraft((value) => value + (value && !value.endsWith("\n") ? "\n" : "") + "- [ ] ")} className="text-xs text-primary-strong disabled:opacity-40">체크리스트 추가</button>
          <span className="mr-auto text-[11px] tabular-nums text-dark-gray/60">{draft.length}/{SCHEDULE_ITEM_MEMO_MAX_LENGTH}</span>
          <button type="button" disabled={saving.isPending} onClick={() => { usePlanMemoDraftsStore.getState().remove(key); onClose(); }} className={PLAN_PLACE_CARD_TW.timeSaveButtonCompact}>취소</button>
          <button type="button" disabled={disabled || !dirty || !isMemoVersion(baseVersion)} onClick={save} className={cn("bg-primary text-white disabled:opacity-40", PLAN_PLACE_CARD_TW.timeSaveButtonCompact)}>{saving.isPending ? "저장 중…" : "저장"}</button>
        </div>
      </div>
    </div>
    <MemoOverwriteConfirmDialog open={reviewed !== null} latest={reviewed} isPending={disabled || !isMemoVersion(reviewed?.memoVersion)} onCancel={() => setReviewed(null)} onConfirm={() => void commit(reviewed?.memoVersion)} />
  </>;
}

function MemoSaveNotice({ saving }: { saving: ReturnType<typeof useMemoSave> }) {
  return <>
    {saving.error && <p role="alert" className="text-sm text-red-700">{saving.error}</p>}
    {saving.needsRefresh && !saving.blocked && <button type="button" disabled={saving.isPending} onClick={() => void saving.refresh()}>최신 메모 다시 불러오기</button>}
  </>;
}

export function PlanItemMemoDisplay({ roomId, scheduleId, itemId, memo, memoVersion }: Omit<PlanItemMemoEditorProps, "onClose">) {
  const saving = useMemoSave(roomId, scheduleId, itemId);
  const [confirmDelete, setConfirmDelete] = useState<MemoSnapshot | null>(null);
  const disabled = saving.isPending || saving.blocked || saving.needsRefresh || !isMemoVersion(memoVersion);
  return <div onMouseDown={stopCardActivation} onClick={stopCardActivation}>
    <PlanItemMemoReadOnly memo={memo ?? ""} isDeleting={disabled}
      onToggle={(next) => { saving.setConflict(null); void saving.save(next, memoVersion); }}
      onDelete={() => setConfirmDelete({ memo, memoVersion })} />
    <MemoSaveNotice saving={saving} />
    {saving.conflict && <div className="rounded border border-gray-border p-2"><p>최신 메모예요. 내용을 확인하고 체크박스를 다시 눌러 주세요.</p><MemoMarkdown memo={saving.conflict.memo ?? ""} /></div>}
    <MemoOverwriteConfirmDialog open={confirmDelete !== null} latest={confirmDelete} isPending={disabled} onCancel={() => setConfirmDelete(null)} onConfirm={() => { const version = confirmDelete?.memoVersion; setConfirmDelete(null); void saving.save("", version); }} />
  </div>;
}

export function PlanMemoDraftRecovery({ roomId }: { roomId: string }) {
  const drafts = usePlanMemoDraftsStore((s) => s.drafts);
  return <>{Object.entries(drafts).filter(([, d]) => d.roomId === roomId && !d.active).map(([key, d]) => <div key={key} className="rounded border border-gray-border bg-white p-3">
    <p>닫히거나 이동·삭제된 장소의 메모 초안을 보관했어요. 필요한 내용을 복사해 주세요.</p>
    <textarea aria-label="보관된 메모 초안" readOnly value={d.draft} className="w-full select-text" />
    <button type="button" onClick={() => usePlanMemoDraftsStore.getState().remove(key)}>초안 버리기</button>
  </div>)}</>;
}
