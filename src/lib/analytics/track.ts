import { sendAnalyticsDataCommand } from "@/lib/analytics/client";
import {
  buildAnalyticsEventPageContext,
  type AnalyticsEntryPoint,
  type AnalyticsEventPageContext,
  type AnalyticsRoomRole,
  type ItemCountBucket,
  type MemberCountBucket,
  type ResultCountBucket,
  type SearchRankBucket,
  type TripDaysBucket,
} from "@/lib/analytics/context";

export type AnalyticsUserIdCommand = [
  "set",
  { user_id: string | null },
];

export function buildAnalyticsUserIdCommand(
  userId: number | null | undefined,
): AnalyticsUserIdCommand {
  const normalized =
    typeof userId === "number" && Number.isSafeInteger(userId) && userId > 0
      ? String(userId)
      : null;
  return ["set", { user_id: normalized }];
}

export function setAnalyticsUserId(userId: number | null | undefined): void {
  sendAnalyticsDataCommand(...buildAnalyticsUserIdCommand(userId));
}

export const AnalyticsEvents = {
  ctaClick: "cta_click",
  sectionView: "section_view",
  signUp: "sign_up",
  login: "login",
  createBookmarkFolder: "create_bookmark_folder",
  addToBookmark: "add_to_bookmark",
  createPlan: "create_plan",
  viewPlan: "view_plan",
  inviteView: "invite_view",
  joinPlan: "join_group",
  viewPlace: "view_place",
  addToItinerary: "add_to_itinerary",
  removeFromItinerary: "remove_from_itinerary",
  reorderItinerary: "reorder_itinerary",
  search: "view_search_results",
  sharePlan: "share",
  inviteCodeIssued: "invite_code_issued",
  roomInfoUpdated: "room_info_updated",
  chatMessageSent: "chat_message_sent",
  tutorialBegin: "tutorial_begin",
  tutorialComplete: "tutorial_complete",
  tutorialSkip: "tutorial_skip",
  expenseCreated: "expense_created",
  expenseUpdated: "expense_updated",
  expenseDeleted: "expense_deleted",
  expenseBudgetSaved: "expense_budget_saved",
  settlementSummaryViewed: "settlement_summary_viewed",
  packingItemAdded: "packing_item_added",
  packingItemChecked: "packing_item_checked",
  packingItemUnchecked: "packing_item_unchecked",
} as const;

export type AnalyticsSource = "bookmark" | "chat" | "map" | "plan" | "search";

export type ItinerarySource = AnalyticsSource;

export type SharePlanMethod = "copy_link" | "native_share";

export const TUTORIAL_ANALYTICS_VERSION = "sidebar_v1";

const tutorialSkipSteps = ["1", "2", "3", "4", "5"] as const;

export type TutorialAnalyticsVersion = typeof TUTORIAL_ANALYTICS_VERSION;
export type TutorialExitReason = "complete" | "skip";

export type LandingSectionId =
  | "hero"
  | "problem"
  | "solution"
  | "features"
  | "devices"
  | "travel_steps"
  | "final_cta";

export type AnalyticsEventParamsMap = {
  [AnalyticsEvents.inviteCodeIssued]: { room_id: string; role: AnalyticsRoomRole };
  [AnalyticsEvents.roomInfoUpdated]: { room_id: string; role: AnalyticsRoomRole };
  [AnalyticsEvents.expenseCreated]: { room_id: string };
  [AnalyticsEvents.expenseUpdated]: { room_id: string };
  [AnalyticsEvents.expenseDeleted]: { room_id: string };
  [AnalyticsEvents.expenseBudgetSaved]: { room_id: string };
  [AnalyticsEvents.settlementSummaryViewed]: { room_id: string };
  [AnalyticsEvents.packingItemAdded]: { room_id: string };
  [AnalyticsEvents.packingItemChecked]: { room_id: string };
  [AnalyticsEvents.packingItemUnchecked]: { room_id: string };
  [AnalyticsEvents.ctaClick]: {
    page_type: "landing";
    cta_id: "login" | "start_trip";
    cta_position: "header" | "hero" | "final";
  };
  [AnalyticsEvents.sectionView]: {
    page_type: "landing";
    section_id: LandingSectionId;
  };
  [AnalyticsEvents.signUp]: {
    entry_point: AnalyticsEntryPoint;
    method: "google";
  };
  [AnalyticsEvents.login]: {
    entry_point: AnalyticsEntryPoint;
    method: "google";
  };
  [AnalyticsEvents.createBookmarkFolder]: { room_id: string };
  [AnalyticsEvents.addToBookmark]: {
    room_id: string;
    interaction_source?: AnalyticsSource;
    place_category?: string;
  };
  [AnalyticsEvents.createPlan]: {
    room_id: string;
    entry_point: AnalyticsEntryPoint;
    trip_days_bucket?: TripDaysBucket;
  };
  [AnalyticsEvents.viewPlan]: {
    room_id: string;
    member_count_bucket: MemberCountBucket;
    role?: AnalyticsRoomRole;
  };
  [AnalyticsEvents.inviteView]: {
    entry_point: AnalyticsEntryPoint;
  };
  [AnalyticsEvents.joinPlan]: {
    room_id: string;
    member_count_bucket?: MemberCountBucket;
    role?: AnalyticsRoomRole;
  };
  [AnalyticsEvents.viewPlace]: {
    room_id?: string;
    interaction_source?: AnalyticsSource;
    place_category?: string;
    rank_bucket?: SearchRankBucket;
  };
  [AnalyticsEvents.addToItinerary]: {
    room_id: string;
    interaction_source: AnalyticsSource;
    item_count_bucket: ItemCountBucket;
    place_category?: string;
  };
  [AnalyticsEvents.removeFromItinerary]: {
    room_id: string;
    item_count_bucket: ItemCountBucket;
  };
  [AnalyticsEvents.reorderItinerary]: {
    room_id: string;
    item_count_bucket: ItemCountBucket;
    method: "drag_drop";
  };
  [AnalyticsEvents.search]: {
    room_id?: string;
    result_count_bucket: ResultCountBucket;
    search_mode: "map_recenter" | "text";
  };
  [AnalyticsEvents.sharePlan]: {
    room_id: string;
    member_count_bucket?: MemberCountBucket;
    method: SharePlanMethod;
    role?: AnalyticsRoomRole;
  };
  [AnalyticsEvents.chatMessageSent]: {
    room_id: string;
    message_type: "ai" | "place" | "text";
  };
  [AnalyticsEvents.tutorialBegin]: {
    room_id?: string;
    tutorial_version: TutorialAnalyticsVersion;
  };
  [AnalyticsEvents.tutorialComplete]: {
    room_id?: string;
    tutorial_version: TutorialAnalyticsVersion;
  };
  [AnalyticsEvents.tutorialSkip]: {
    room_id?: string;
    skip_step: (typeof tutorialSkipSteps)[number];
    tutorial_version: TutorialAnalyticsVersion;
  };
};

export type TutorialExitAnalyticsEvent =
  | {
      eventName: typeof AnalyticsEvents.tutorialComplete;
      params: AnalyticsEventParamsMap[typeof AnalyticsEvents.tutorialComplete];
    }
  | {
      eventName: typeof AnalyticsEvents.tutorialSkip;
      params: AnalyticsEventParamsMap[typeof AnalyticsEvents.tutorialSkip];
    };

export function buildTutorialExitAnalyticsEvent(
  reason: TutorialExitReason,
  zeroBasedStep: number,
): TutorialExitAnalyticsEvent {
  if (reason === "complete") {
    return {
      eventName: AnalyticsEvents.tutorialComplete,
      params: { tutorial_version: TUTORIAL_ANALYTICS_VERSION },
    };
  }

  const skipStep = tutorialSkipSteps[zeroBasedStep];
  if (!skipStep) {
    throw new RangeError("Tutorial skip step must be between 0 and 4.");
  }
  return {
    eventName: AnalyticsEvents.tutorialSkip,
    params: {
      skip_step: skipStep,
      tutorial_version: TUTORIAL_ANALYTICS_VERSION,
    },
  };
}

export type AnalyticsEventName = keyof AnalyticsEventParamsMap;

type AnalyticsEventArguments<EventName extends AnalyticsEventName> =
  AnalyticsEventParamsMap[EventName] extends undefined
    ? [params?: undefined]
    : [params: AnalyticsEventParamsMap[EventName]];

function cleanParams(
  params?: object,
): Record<string, string | number | boolean> {
  if (!params) return {};
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function currentAnalyticsEventPageContext():
  | AnalyticsEventPageContext
  | undefined {
  if (
    typeof window === "undefined" ||
    typeof window.location?.origin !== "string" ||
    typeof window.location?.pathname !== "string"
  ) {
    return undefined;
  }

  return buildAnalyticsEventPageContext(
    window.location.origin,
    window.location.pathname,
  );
}

export function trackAnalyticsEvent<EventName extends AnalyticsEventName>(
  eventName: EventName,
  ...args: AnalyticsEventArguments<EventName>
): void {
  const params = args[0];
  const cleaned = {
    ...cleanParams(params),
    ...currentAnalyticsEventPageContext(),
  };
  if (Object.keys(cleaned).length > 0) {
    sendAnalyticsDataCommand("event", eventName, cleaned);
  } else {
    sendAnalyticsDataCommand("event", eventName);
  }
}
