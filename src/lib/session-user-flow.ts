import { inviteCampaignSearch, withInviteCampaign } from "@/lib/invite-campaign";

export async function checkClientAuthenticated(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const res = await fetch("/api/auth/session", {
    credentials: "include",
    cache: "no-store",
  });
  return res.ok;
}

const PENDING_INVITE_KEY = "pendingInviteCode";
const PENDING_INVITE_CAMPAIGN_KEY = "pendingInviteCampaign";

export function setPendingInviteCode(code: string, search = ""): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_INVITE_CAMPAIGN_KEY);
  sessionStorage.setItem(PENDING_INVITE_KEY, code);
  const campaign = inviteCampaignSearch(search);
  if (campaign) sessionStorage.setItem(PENDING_INVITE_CAMPAIGN_KEY, campaign);
}

export function consumePendingInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(PENDING_INVITE_KEY);
  sessionStorage.removeItem(PENDING_INVITE_KEY);
  sessionStorage.removeItem(PENDING_INVITE_CAMPAIGN_KEY);
  return value;
}

function pendingInviteCampaign(): string {
  if (typeof window === "undefined" || !sessionStorage.getItem(PENDING_INVITE_KEY)) return "";
  return sessionStorage.getItem(PENDING_INVITE_CAMPAIGN_KEY) ?? "";
}

export function pendingInviteAuthPath(path: "/login" | "/login/agreements" | `/login?error=${string}`): string {
  return withInviteCampaign(path, pendingInviteCampaign());
}

export function pendingInviteReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  const code = sessionStorage.getItem(PENDING_INVITE_KEY);
  return code ? withInviteCampaign(`/join/${encodeURIComponent(code)}`, pendingInviteCampaign()) : null;
}
