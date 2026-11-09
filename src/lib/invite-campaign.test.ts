import { describe, expect, it } from "vitest";
import { buildSharedInviteUrl, inviteCampaignSearch, withInviteCampaign } from "./invite-campaign";

describe("invite campaign URLs", () => {
  it("tags an outgoing invitation with the approved campaign", () => {
    expect(buildSharedInviteUrl("https://example.test/join/test-invite"))
      .toBe("https://example.test/join/test-invite?utm_source=member_invite&utm_medium=referral&utm_campaign=invite");
  });
  it.each([
    "utm_source=partner&utm_medium=email&utm_campaign=launch&utm_content=a",
    "utm_campaign=launch", "utm_source=", "utm_custom=keep",
  ])("does not mix defaults into an existing campaign: %s", search => {
    const url = `https://example.test/join/test-invite?${search}#section`;
    expect(buildSharedInviteUrl(url)).toBe(url);
  });
  it("carries only allowed campaign keys, including empty and repeated values", () => {
    expect(inviteCampaignSearch("?utm_source=partner&utm_content=a&utm_content=b&utm_campaign=&code=secret&state=secret&inviteCode=secret&redirect=https://other.test#hash"))
      .toBe("utm_source=partner&utm_content=a&utm_content=b&utm_campaign=");
  });
  it("preserves destination campaign as one set, rather than merging fields", () => {
    expect(withInviteCampaign("/login?utm_campaign=other&error=OAuthCallback", "utm_source=member_invite"))
      .toBe("/login?utm_campaign=other&error=OAuthCallback");
  });
  it("carries context without inventing a default on internal navigation", () => {
    expect(withInviteCampaign("/login?error=OAuthCallback", "utm_source=partner"))
      .toBe("/login?error=OAuthCallback&utm_source=partner");
    expect(withInviteCampaign("/login", "")).toBe("/login");
  });
});
