import type { AnalyticsEventName } from "./track";

export type AnalyticsDestination = "both" | "ga4" | "amplitude";

/** Every event must declare its purpose; new events never default to both sinks. */
const eventDestinations = {
  page_view: "both",
  sign_up: "both",
  login: "both",
  create_plan: "both",
  invite_view: "both",
  join_group: "both",
  view_plan: "both",
  share: "both",
  add_to_bookmark: "both",
  add_to_itinerary: "both",
  expense_created: "both",
  packing_item_added: "both",
  cta_click: "ga4",
  section_view: "ga4",
  view_search_results: "amplitude",
  view_place: "amplitude",
  create_bookmark_folder: "amplitude",
  remove_from_itinerary: "amplitude",
  reorder_itinerary: "amplitude",
  chat_message_sent: "amplitude",
  tutorial_begin: "amplitude",
  tutorial_complete: "amplitude",
  tutorial_skip: "amplitude",
  expense_updated: "amplitude",
  expense_deleted: "amplitude",
  expense_budget_saved: "amplitude",
  settlement_summary_viewed: "amplitude",
  packing_item_checked: "amplitude",
  packing_item_unchecked: "amplitude",
} as const satisfies Record<AnalyticsEventName | "page_view", AnalyticsDestination>;

export function getAnalyticsEventDestination(name: unknown): AnalyticsDestination | undefined {
  if (typeof name !== "string" || !Object.hasOwn(eventDestinations, name)) return;
  return eventDestinations[name as keyof typeof eventDestinations];
}
