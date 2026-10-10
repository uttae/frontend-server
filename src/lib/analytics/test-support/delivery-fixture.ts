import { afterEach, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  initAll: vi.fn(async () => {}),
  track: vi.fn(),
  setUserId: vi.fn(),
  setOptOut: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@amplitude/unified", () => sdk);
vi.mock("../runtime", () => ({ analyticsRuntime: { enabled: true } }));
vi.mock("../amplitude-runtime", () => ({
  amplitudeRuntime: { enabled: true, apiKey: "local-test", sessionReplaySampleRate: 0 },
}));

afterEach(() => {
  document.cookie = "uttae_analytics_consent=; Max-Age=0; Path=/";
  delete window.gtag;
  delete window.dataLayer;
  vi.resetModules();
  vi.clearAllMocks();
});

export { sdk };
