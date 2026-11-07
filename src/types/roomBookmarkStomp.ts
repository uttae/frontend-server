export type RoomBookmarkChangedType =
  | "BOOKMARK_CREATED"
  | "BOOKMARK_UPDATED"
  | "BOOKMARK_DELETED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "CATEGORY_DELETED";

export type RoomBookmarkChangedEvent = {
  actorUserId: number;
  bookmarkId: number;
  categoryId: number;
  roomId: string;
  type: RoomBookmarkChangedType;
  /** 변경 요청을 보낸 탭 ID — 같으면 이 탭의 반향(`isOwnEcho`) */
  originTabId?: string | null;
};
