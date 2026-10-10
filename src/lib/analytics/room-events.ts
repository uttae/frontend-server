import type { AnalyticsEventName } from "./track";

type RoomScope = "required" | "optional" | "none";

/** Describe the event's target, never infer a room from global selected state. */
const roomScopes = {
  page_view: "optional",
  sign_up: "none",
  login: "none",
  invite_view: "none",
  cta_click: "none",
  section_view: "none",
  share: "required",
  join_group: "required",
  create_plan: "required",
  view_plan: "required",
  create_bookmark_folder: "required",
  add_to_bookmark: "required",
  add_to_itinerary: "required",
  remove_from_itinerary: "required",
  reorder_itinerary: "required",
  chat_message_sent: "required",
  expense_created: "required",
  expense_updated: "required",
  expense_deleted: "required",
  expense_budget_saved: "required",
  settlement_summary_viewed: "required",
  packing_item_added: "required",
  packing_item_checked: "required",
  packing_item_unchecked: "required",
  view_search_results: "optional",
  view_place: "optional",
  tutorial_begin: "optional",
  tutorial_complete: "optional",
  tutorial_skip: "optional",
} as const satisfies Record<AnalyticsEventName | "page_view", RoomScope>;

export function getAnalyticsEventRoomId(
  eventName: string,
  properties: Record<string, unknown> | undefined,
): string | undefined {
  if (!Object.hasOwn(roomScopes, eventName)) return;
  if (roomScopes[eventName as keyof typeof roomScopes] === "none") return;
  const value = properties?.room_id;
  return typeof value === "string" ? value.trim() || undefined : undefined;
}
