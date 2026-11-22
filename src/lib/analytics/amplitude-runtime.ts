const DEFAULT_PRODUCTION_REPLAY_SAMPLE_RATE = 0.1;
const DEFAULT_NON_PRODUCTION_REPLAY_SAMPLE_RATE = 1;

type AmplitudeRuntimeInput = {
  apiKey?: string;
  nodeEnv?: string;
  sessionReplaySampleRate?: string;
};

export type AmplitudeRuntime = {
  apiKey: string | null;
  enabled: boolean;
  sessionReplaySampleRate: number;
};

export function resolveAmplitudeRuntime({
  apiKey,
  nodeEnv,
  sessionReplaySampleRate,
}: AmplitudeRuntimeInput): AmplitudeRuntime {
  const normalizedApiKey = apiKey?.trim() ?? "";
  const normalizedSampleRate = sessionReplaySampleRate?.trim();
  const configuredSampleRate = Number(normalizedSampleRate);
  const defaultSampleRate =
    nodeEnv === "production" ? DEFAULT_PRODUCTION_REPLAY_SAMPLE_RATE : DEFAULT_NON_PRODUCTION_REPLAY_SAMPLE_RATE;
  const validConfiguredSampleRate =
    normalizedSampleRate !== undefined &&
    normalizedSampleRate !== "" &&
    Number.isFinite(configuredSampleRate) &&
    configuredSampleRate >= 0 &&
    configuredSampleRate <= 1;

  return {
    apiKey: normalizedApiKey || null,
    enabled: Boolean(normalizedApiKey),
    sessionReplaySampleRate: validConfiguredSampleRate ? configuredSampleRate : defaultSampleRate,
  };
}

export const amplitudeRuntime = resolveAmplitudeRuntime({
  apiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY,
  nodeEnv: process.env.NODE_ENV,
  sessionReplaySampleRate: process.env.NEXT_PUBLIC_AMPLITUDE_SESSION_REPLAY_SAMPLE_RATE,
});
