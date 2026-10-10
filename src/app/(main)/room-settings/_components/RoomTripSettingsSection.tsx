"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DeleteConfirmModal } from "@/app/home/_components/DeleteConfirmModal";
import { RoomTripEditForm } from "@/components/rooms/RoomTripEditForm";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { useCurrentRoomMembership } from "@/hooks/useCurrentRoomMembership";
import { isRoomMemberRole } from "@/lib/rooms";
import { useSessionStore } from "@/stores/session-store";

/** 방장 전용 여행 삭제 — 제목 옆 작은 텍스트 버튼과 삭제 확인 */
export function RoomTripDeleteButton() {
  const router = useRouter();
  const { roomSource, isHost, isLoading } = useCurrentRoomMembership();
  const clearCurrentRoomId = useSessionStore((s) => s.clearCurrentRoomId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading || !isHost || !roomSource) return null;

  return (
    <>
      <button
        type="button"
        data-skip-autofocus
        onClick={() => setDeleteOpen(true)}
        className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-label-s-regular text-status-negative underline underline-offset-2 transition-colors hover:bg-status-negative/5"
      >
        여행 삭제
      </button>
      {deleteOpen ? (
        <DeleteConfirmModal
          room={{ id: roomSource.id, title: roomSource.title }}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            clearCurrentRoomId();
            router.replace("/home");
          }}
        />
      ) : null}
    </>
  );
}

export function RoomTripSettingsSection({
  embedded = false,
  onCancel,
  onSaved,
}: {
  embedded?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const { roomId, roomSource, isLoading } = useCurrentRoomMembership();
  const canEdit = isRoomMemberRole(roomSource?.role);
  const description = !isLoading && roomSource && roomId && !canEdit
    ? "여행 멤버만 여행 정보를 수정할 수 있어요."
    : undefined;

  return (
    <div className="flex min-w-0 w-full flex-col gap-6">
      {embedded ? (
        description ? <p className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">{description}</p> : null
      ) : (
        <MainPageHeader title="여행 정보 수정" description={description} action={<RoomTripDeleteButton />} />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
        </div>
      ) : !roomSource || !roomId ? (
        <p className="py-10 text-center text-body-m-regular mobile:text-body-s-regular text-dark-gray">
          여행 정보를 불러오지 못했어요.
        </p>
      ) : (
        <RoomTripEditForm room={roomSource} readOnly={!canEdit} onCancel={onCancel} onSaved={onSaved} />
      )}
    </div>
  );
}
