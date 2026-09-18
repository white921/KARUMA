export function shouldRegisterCommandsOnBoot(value?: string): boolean {
  return value?.toLowerCase() === "true";
}

export function isRuntimeFeatureEnabled(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function normalizePollingIntervalMs(
  value: string | undefined,
  fallbackMs: number,
  minIntervalMs = 30_000,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackMs;
  }

  return Math.max(minIntervalMs, parsed);
}

export function normalizePositiveInteger(
  value: string | undefined,
  fallback: number,
  minValue = 1,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.max(minValue, parsed);
}
