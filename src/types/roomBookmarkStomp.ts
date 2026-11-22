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
  originTabId?: string | null;
};
