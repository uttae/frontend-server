import { beforeEach, describe, expect, it, vi } from "vitest";

const amplitude = vi.hoisted(() => ({
  initAll: vi.fn(() => Promise.resolve()),
  setOptOut: vi.fn(),
  setUserId: vi.fn(),
  track: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

vi.mock("@amplitude/unified", () => amplitude);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "test-api-key");
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_SESSION_REPLAY_SAMPLE_RATE", "0.2");
  vi.stubEnv("NODE_ENV", "production");
});

describe("Amplitude browser client", () => {
  it("initializes Analytics and Session Replay once per application lifecycle", async () => {
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.initializeAmplitude();
    client.initializeAmplitude();

    expect(amplitude.initAll).toHaveBeenCalledTimes(1);
    expect(amplitude.initAll).toHaveBeenCalledWith("test-api-key", {
      analytics: {
        minIdLength: 1,
        autocapture: {
          attribution: true,
          elementInteractions: false,
          fileDownloads: false,
          formInteractions: false,
          frustrationInteractions: false,
          networkTracking: false,
          pageUrlEnrichment: false,
          pageViews: false,
          performanceTracking: false,
          sessions: true,
          webVitals: false,
        },
      },
      sessionReplay: {
        privacyConfig: {
          blockSelector: [".amp-block", "[data-amplitude-block]"],
          defaultMaskLevel: "conservative",
          maskSelector: [".amp-mask", "[data-amplitude-mask]"],
        },
        sampleRate: 0.2,
      },
    });
  });

  it("does not initialize outside the browser", async () => {
    const client = await import("@/lib/analytics/amplitude");

    client.initializeAmplitude();

    expect(amplitude.initAll).not.toHaveBeenCalled();
  });

  it("does not initialize or retain events without an environment key", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.sendAmplitudeDataCommand("event", "create_plan", { days: 3 });
    client.initializeAmplitude();

    expect(amplitude.initAll).not.toHaveBeenCalled();
    expect(amplitude.track).not.toHaveBeenCalled();
  });

  it("forwards queued key events and user identity after initialization", async () => {
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.sendAmplitudeDataCommand("event", "create_plan", { days: 3 });
    client.sendAmplitudeDataCommand("set", { user_id: "42" });

    expect(amplitude.track).not.toHaveBeenCalled();
    expect(amplitude.setUserId).not.toHaveBeenCalled();

    client.initializeAmplitude();

    await vi.waitFor(() => {
      expect(amplitude.track).toHaveBeenCalledWith("create_plan", { days: 3 });
      expect(amplitude.setUserId).toHaveBeenCalledWith("42");
    });
  });

  it("keeps queued commands pending until initialization succeeds", async () => {
    const initialization = deferred<void>();
    amplitude.initAll.mockReturnValueOnce(initialization.promise);
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.sendAmplitudeDataCommand("event", "create_plan", { days: 3 });
    client.initializeAmplitude();

    expect(amplitude.setOptOut).not.toHaveBeenCalled();
    expect(amplitude.track).not.toHaveBeenCalled();

    initialization.resolve();

    await vi.waitFor(() => {
      expect(amplitude.setOptOut).toHaveBeenCalledWith(false);
      expect(amplitude.track).toHaveBeenCalledWith("create_plan", { days: 3 });
    });
  });

  it("preserves queued commands and allows retry after initialization fails", async () => {
    const firstInitialization = deferred<void>();
    amplitude.initAll
      .mockReturnValueOnce(firstInitialization.promise)
      .mockResolvedValueOnce();
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.sendAmplitudeDataCommand("event", "create_plan", { days: 3 });
    client.initializeAmplitude();
    firstInitialization.reject(new Error("remote config unavailable"));
    await firstInitialization.promise.catch(() => undefined);

    client.initializeAmplitude();

    await vi.waitFor(() => {
      expect(amplitude.initAll).toHaveBeenCalledTimes(2);
      expect(amplitude.track).toHaveBeenCalledWith("create_plan", { days: 3 });
    });
  });

  it("does not re-enable or flush analytics when consent is revoked during initialization", async () => {
    const initialization = deferred<void>();
    amplitude.initAll.mockReturnValueOnce(initialization.promise);
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.sendAmplitudeDataCommand("event", "create_plan", { days: 3 });
    client.initializeAmplitude();
    client.revokeAmplitudeConsent();
    initialization.resolve();
    await initialization.promise;
    await Promise.resolve();

    expect(amplitude.setOptOut).not.toHaveBeenCalledWith(false);
    expect(amplitude.track).not.toHaveBeenCalled();
  });

  it("discards commands issued after consent is revoked during initialization", async () => {
    const initialization = deferred<void>();
    amplitude.initAll.mockReturnValueOnce(initialization.promise);
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.initializeAmplitude();
    client.revokeAmplitudeConsent();
    client.sendAmplitudeDataCommand("event", "denied_event");
    initialization.resolve();
    await initialization.promise;
    await Promise.resolve();

    client.initializeAmplitude();

    expect(amplitude.track).not.toHaveBeenCalled();
  });

  it("opts out after consent is revoked and resumes without reinitializing", async () => {
    vi.stubGlobal("window", {});
    const client = await import("@/lib/analytics/amplitude");

    client.initializeAmplitude();
    await vi.waitFor(() => {
      expect(amplitude.setOptOut).toHaveBeenCalledWith(false);
    });
    client.revokeAmplitudeConsent();
    client.initializeAmplitude();

    expect(amplitude.initAll).toHaveBeenCalledTimes(1);
    expect(amplitude.setOptOut).toHaveBeenNthCalledWith(1, false);
    expect(amplitude.setOptOut).toHaveBeenNthCalledWith(2, true);
    expect(amplitude.setOptOut).toHaveBeenNthCalledWith(3, false);
    expect(amplitude.setUserId).toHaveBeenCalledWith(undefined);
  });
});
