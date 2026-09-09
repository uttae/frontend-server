import { expect, it, vi } from "vitest";
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
import PrivacySettingsPage from "./page";
it("redirects the legacy settings URL to the landing modal entry", () => {
  expect(() => PrivacySettingsPage()).toThrow("redirect");
  expect(redirect).toHaveBeenCalledWith("/?cookie-settings=open");
});
