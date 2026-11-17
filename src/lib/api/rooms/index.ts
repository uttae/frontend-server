export { HttpError } from "@/lib/api/errors";

export type {
  BookmarkCategory,
  BookmarkCategoryCreateRequest,
  BookmarkCategoryUpdateRequest,
  JoinRequest,
  JoinRequestListResponse,
  JoinRoomResponse,
  RoomBookmark,
  RoomBookmarkBulkCreateRequest,
  RoomBookmarkCategoryPatchRequest,
  RoomCreateRequest,
  RoomCreateResponse,
  RoomDetail,
  RoomListItem,
  RoomListResponse,
  RoomMember,
  RoomMemberListResponse,
  RoomMemberStatus,
  RoomMessage,
  RoomUpdateRequest,
} from "./types";

export type { JoinRoomApiResult } from "./join";

export {
  createBookmarkCategory,
  deleteBookmarkCategory,
  getBookmarkCategories,
  updateBookmarkCategory,
} from "./bookmark-categories";

export {
  createRoomBookmarks,
  deleteRoomBookmark,
  getAllRoomBookmarks,
  patchRoomBookmarkCategory,
} from "./bookmarks";

export {
  createRoom,
  deleteRoom,
  getRoomDetail,
  getRooms,
  regenerateInviteCode,
  updateRoom,
} from "./core";

export type {
  RoomSchedule,
  RoomScheduleCreateRequest,
  RoomScheduleMoveRequest,
  RoomScheduleWithItems,
  GetRoomSchedulesOptions,
} from "./schedules";

export type {
  CreateScheduleItemResponse,
  MoveScheduleItemToScheduleRequest,
  RoomScheduleItem,
  RoomScheduleItemCreateRequest,
  RoomScheduleItemUpdateRequest,
  ReorderScheduleItemRequest,
  ScheduleItemRouteBatchItem,
  ScheduleItemRouteBatchRequestItem,
  ScheduleItemRouteLeg,
  ScheduleItemRouteResponse,
  UpdateTravelModeRequest,
} from "./schedule-items";

export {
  createRoomSchedule,
  deleteRoomSchedule,
  getRoomSchedules,
  moveRoomSchedule,
} from "./schedules";

export {
  createScheduleItem,
  deleteScheduleItem,
  getScheduleItems,
  getScheduleItemRoute,
  getScheduleItemRoutesBatch,
  moveScheduleItemToSchedule,
  reorderScheduleItem,
  updateScheduleItem,
  updateScheduleItemTravelMode,
} from "./schedule-items";

export {
  approveJoinRequest,
  getJoinRequests,
  getJoinStatus,
  joinRoom,
  rejectJoinRequest,
} from "./join";

export { getRoomMembers, kickMember, leaveRoom, transferHost } from "./members";

export {
  getRoomMessageReadStatus,
  getRoomMessages,
  getRoomUnreadCount,
} from "./messages";
