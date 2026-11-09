import { analyticsCampaignParameterNames } from "@/lib/analytics/context";

const allowedCampaignNames = new Set<string>(analyticsCampaignParameterNames);
const defaultInviteCampaign = "utm_source=member_invite&utm_medium=referral&utm_campaign=invite";

function hasCampaign(search: URLSearchParams): boolean {
  return [...search.keys()].some(name => name.startsWith("utm_"));
}

/** Navigation context only: never retain OAuth parameters, arbitrary queries or fragments. */
export function inviteCampaignSearch(search: string): string {
  const source = new URLSearchParams(search.split("#", 1)[0]);
  const campaign = new URLSearchParams();
  for (const [name, value] of source) {
    if (allowedCampaignNames.has(name)) campaign.append(name, value);
  }
  return campaign.toString();
}

/** Preserve an existing campaign as a whole, including partial/empty sets. */
export function withInviteCampaign(path: string, campaign: string): string {
  const hashIndex = path.indexOf("#");
  const beforeHash = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : path.slice(hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const search = new URLSearchParams(queryIndex === -1 ? "" : beforeHash.slice(queryIndex + 1));
  if (hasCampaign(search)) return path;
  const allowedCampaign = inviteCampaignSearch(campaign);
  if (!allowedCampaign) return path;
  const separator = queryIndex === -1 ? "?" : beforeHash.endsWith("?") ? "" : "&";
  return `${beforeHash}${separator}${allowedCampaign}${fragment}`;
}

/** Only outgoing copy/share links create the default invitation campaign. */
export function buildSharedInviteUrl(url: string): string {
  return withInviteCampaign(url, defaultInviteCampaign);
}
