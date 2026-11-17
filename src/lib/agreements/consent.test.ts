import { describe, expect, it } from "vitest";

import { createAgreementConsentSchema } from "./consent";

describe("createAgreementConsentSchema", () => {
  const schema = createAgreementConsentSchema(["TERMS_OF_SERVICE:v2", "PRIVACY_POLICY:v1"]);

  it("passes only when every required agreement on the server list is checked", () => {
    expect(schema.safeParse(["PRIVACY_POLICY:v1", "TERMS_OF_SERVICE:v2"]).success).toBe(true);
    expect(schema.safeParse(["TERMS_OF_SERVICE:v2"]).success).toBe(false);
    // 예전 버전에 동의한 id는 새 버전 동의로 치지 않는다
    expect(schema.safeParse(["TERMS_OF_SERVICE:v1", "PRIVACY_POLICY:v1"]).success).toBe(false);
  });

  it("cannot pass with an empty server list", () => {
    expect(createAgreementConsentSchema([]).safeParse([]).success).toBe(false);
  });
});
