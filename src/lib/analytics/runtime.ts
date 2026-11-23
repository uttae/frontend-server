export type AnalyticsRuntimeInput = {
  debugMode?: string;
  measurementId?: string;
  nodeEnv?: string;
};

export type AnalyticsRuntime = {
  debugMode: boolean;
  enabled: boolean;
  measurementId: string | null;
};

const GA4_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export function resolveAnalyticsRuntime({
  debugMode,
  measurementId,
  nodeEnv,
}: AnalyticsRuntimeInput): AnalyticsRuntime {
  const normalizedMeasurementId = measurementId?.trim() ?? "";
  const validMeasurementId = GA4_MEASUREMENT_ID_PATTERN.test(normalizedMeasurementId) ? normalizedMeasurementId : null;
  const analyticsDebugMode = debugMode === "true";

  return {
    debugMode: analyticsDebugMode,
    enabled: Boolean(validMeasurementId) && (nodeEnv === "production" || analyticsDebugMode),
    measurementId: validMeasurementId,
  };
}

export const analyticsRuntime = resolveAnalyticsRuntime({
  debugMode: process.env.NEXT_PUBLIC_GA_DEBUG_MODE,
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  nodeEnv: process.env.NODE_ENV,
});
