export type AnalyticsEntryPoint = "direct" | "invite";
export type AnalyticsRoomRole = "host" | "member";
export type ItemCountBucket = "0" | "1" | "2_3" | "4_7" | "8_plus";
export type MemberCountBucket = "0" | "1" | "2" | "3_4" | "5_plus";
export type ResultCountBucket = "0" | "1_5" | "6_20" | "21_plus";
export type SearchRankBucket = "1_3" | "4_10" | "11_plus";
export type TripDaysBucket = "1" | "2_3" | "4_7" | "8_plus";

export type AnalyticsPageViewInput = {
  origin: string;
  pathname: string;
  referrer: string;
  search?: string;
  title: string;
};

export type AnalyticsPageViewParams = {
  room_id?: string;
  page_location: string;
  page_path: string;
  page_referrer?: string;
  page_title: string;
};

export type AnalyticsEventPageContext = Pick<
  AnalyticsPageViewParams,
  "page_location" | "page_path"
>;

const dynamicPagePaths: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/join\/[^/]+$/, "/join/[inviteCode]"],
  [/^\/plan\/[^/]+$/, "/plan/[roomId]"],
  [/^\/packing\/[^/]+$/, "/packing/[roomId]"],
  [/^\/bookmark\/[^/]+$/, "/bookmark/[folderId]"],
];

const analyticsCampaignParameterNames = [
  "utm_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_source_platform",
  "utm_term",
  "utm_content",
  "utm_creative_format",
  "utm_marketing_tactic",
] as const;

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function bucketMemberCount(count: number): MemberCountBucket {
  const normalized = nonNegativeInteger(count);
  if (normalized === 0) return "0";
  if (normalized === 1) return "1";
  if (normalized === 2) return "2";
  if (normalized <= 4) return "3_4";
  return "5_plus";
}

export function bucketItemCount(count: number): ItemCountBucket {
  const normalized = nonNegativeInteger(count);
  if (normalized === 0) return "0";
  if (normalized === 1) return "1";
  if (normalized <= 3) return "2_3";
  if (normalized <= 7) return "4_7";
  return "8_plus";
}

export function bucketResultCount(count: number): ResultCountBucket {
  const normalized = nonNegativeInteger(count);
  if (normalized === 0) return "0";
  if (normalized <= 5) return "1_5";
  if (normalized <= 20) return "6_20";
  return "21_plus";
}

export function bucketSearchRank(zeroBasedIndex: number): SearchRankBucket {
  const normalized = nonNegativeInteger(zeroBasedIndex);
  if (normalized <= 2) return "1_3";
  if (normalized <= 9) return "4_10";
  return "11_plus";
}

function parseYmdUtc(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

export function bucketTripDays(
  startDate: string | null,
  endDate: string | null,
): TripDaysBucket | undefined {
  if (!startDate || !endDate) return undefined;
  const start = parseYmdUtc(startDate);
  const end = parseYmdUtc(endDate);
  if (start === null || end === null || end < start) return undefined;

  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days === 1) return "1";
  if (days <= 3) return "2_3";
  if (days <= 7) return "4_7";
  return "8_plus";
}

export function analyticsPagePath(pathname: string): string {
  const separatorIndex = pathname.search(/[?#]/);
  const pagePath =
    separatorIndex === -1 ? pathname : pathname.slice(0, separatorIndex);
  if (!pagePath.startsWith("/")) return "/";

  const normalizedPath =
    pagePath.length > 1 ? pagePath.replace(/\/+$/, "") : pagePath;
  const dynamicPath = dynamicPagePaths.find(([pattern]) =>
    pattern.test(normalizedPath),
  );
  return dynamicPath?.[1] ?? normalizedPath;
}

function analyticsCampaignSearch(search: string): string {
  const input = search.split("#", 1)[0];
  const source = new URLSearchParams(
    input.startsWith("?") ? input.slice(1) : input,
  );
  const campaign = new URLSearchParams();

  for (const name of analyticsCampaignParameterNames) {
    const value = source.get(name)?.trim();
    if (value) campaign.set(name, value);
  }

  const query = campaign.toString();
  return query ? `?${query}` : "";
}

function analyticsPageLocation(
  origin: string,
  pathname: string,
  search = "",
): string {
  const pagePath = analyticsPagePath(pathname);
  const campaignSearch = analyticsCampaignSearch(search);
  try {
    return `${new URL(origin).origin}${pagePath}${campaignSearch}`;
  } catch {
    return `${pagePath}${campaignSearch}`;
  }
}

export function buildAnalyticsEventPageContext(
  origin: string,
  pathname: string,
): AnalyticsEventPageContext {
  return {
    page_path: analyticsPagePath(pathname),
    page_location: analyticsPageLocation(origin, pathname),
  };
}

function analyticsPageReferrer(
  origin: string,
  referrer: string,
): string | undefined {
  if (!referrer.trim()) return undefined;

  try {
    const referrerUrl = new URL(referrer);
    if (
      referrerUrl.protocol !== "http:" &&
      referrerUrl.protocol !== "https:"
    ) {
      return undefined;
    }

    let currentOrigin: string | undefined;
    try {
      const currentUrl = new URL(origin);
      if (
        currentUrl.protocol === "http:" ||
        currentUrl.protocol === "https:"
      ) {
        currentOrigin = currentUrl.origin;
      }
    } catch {}

    if (referrerUrl.origin === currentOrigin) {
      return analyticsPageLocation(referrerUrl.origin, referrerUrl.pathname);
    }
    return `${referrerUrl.origin}/`;
  } catch {
    return undefined;
  }
}

export function buildAnalyticsPageView({
  origin,
  pathname,
  referrer,
  search,
  title,
}: AnalyticsPageViewInput): AnalyticsPageViewParams {
  const pageReferrer = analyticsPageReferrer(origin, referrer);
  return {
    page_path: analyticsPagePath(pathname),
    page_location: analyticsPageLocation(origin, pathname, search),
    ...(pageReferrer ? { page_referrer: pageReferrer } : {}),
    page_title: title,
  };
}

export function analyticsEntryPoint(
  pendingInviteCode: string | null,
): AnalyticsEntryPoint {
  return pendingInviteCode?.trim() ? "invite" : "direct";
}

export function toAnalyticsRoomRole(
  role: string | null | undefined,
): AnalyticsRoomRole | undefined {
  const normalized = role?.trim().toUpperCase();
  if (normalized === "HOST") return "host";
  if (normalized === "MEMBER") return "member";
  return undefined;
}
