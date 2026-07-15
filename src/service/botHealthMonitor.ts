import {
  normalizePollingIntervalMs,
  normalizePositiveInteger,
} from "../util/runtimeConfig";

export type PendingInteraction = {
  context: string;
  receivedAt: number;
};

export type InFlightInteraction = {
  context: string;
  receivedAt: number;
  acknowledgedAt: number | null;
};

export type BotHealthState = {
  lastInteractionReceivedAt: number | null;
  oldestPendingInteractionAt: number | null;
  pendingInteractionCount: number;
  pendingInteractions: PendingInteraction[];
  oldestAcknowledgedInteractionAt: number | null;
  inFlightInteractionCount: number;
  inFlightInteractions: InFlightInteraction[];
  lastAckSucceededAt: number | null;
  lastAckDurationMs: number | null;
  maxAckDurationMs: number | null;
  lastAckContext: string | null;
  consecutiveAckFailures: number;
  lastAckFailureContext: string | null;
  lastGatewayReadyAt: number | null;
  lastGatewayDisconnectAt: number | null;
  lastGatewayResumeAt: number | null;
  lastGatewayReconnectAt: number | null;
  lastWatchdogLagMs: number | null;
  maxWatchdogLagMs: number | null;
};

export type BotHealthThresholds = {
  ackTimeoutMs: number;
  handlerTimeoutMs: number;
  gatewayDisconnectTimeoutMs: number;
  maxConsecutiveAckFailures: number;
};

export type BotHealthDecision =
  | { shouldRestart: false }
  | {
      shouldRestart: true;
      reason:
        | "interaction_ack_timeout"
        | "interaction_handler_timeout"
        | "consecutive_ack_failures"
        | "gateway_disconnect_timeout";
    };

const DEFAULT_ACK_TIMEOUT_MS = 30_000;
const DEFAULT_HANDLER_TIMEOUT_MS = 45_000;
const DEFAULT_GATEWAY_DISCONNECT_TIMEOUT_MS = 300_000;
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 15_000;
const DEFAULT_MAX_CONSECUTIVE_ACK_FAILURES = 3;

export function createInitialBotHealthState(): BotHealthState {
  return {
    lastInteractionReceivedAt: null,
    oldestPendingInteractionAt: null,
    pendingInteractionCount: 0,
    pendingInteractions: [],
    oldestAcknowledgedInteractionAt: null,
    inFlightInteractionCount: 0,
    inFlightInteractions: [],
    lastAckSucceededAt: null,
    lastAckDurationMs: null,
    maxAckDurationMs: null,
    lastAckContext: null,
    consecutiveAckFailures: 0,
    lastAckFailureContext: null,
    lastGatewayReadyAt: null,
    lastGatewayDisconnectAt: null,
    lastGatewayResumeAt: null,
    lastGatewayReconnectAt: null,
    lastWatchdogLagMs: null,
    maxWatchdogLagMs: null,
  };
}

function findPendingInteractionIndex(
  pendingInteractions: PendingInteraction[],
  context?: string,
): number {
  if (!context) {
    return pendingInteractions.length > 0 ? 0 : -1;
  }

  const matchingIndex = pendingInteractions.findIndex((pending) =>
    context === pending.context || context.startsWith(`${pending.context}:`),
  );

  return matchingIndex >= 0
    ? matchingIndex
    : pendingInteractions.length > 0
      ? 0
      : -1;
}

function completePendingInteraction(
  state: BotHealthState,
  context: string | undefined,
): {
  pendingInteraction: PendingInteraction | null;
  pendingInteractions: PendingInteraction[];
} {
  const pendingIndex = findPendingInteractionIndex(
    state.pendingInteractions,
    context,
  );

  if (pendingIndex < 0) {
    return {
      pendingInteraction: null,
      pendingInteractions: state.pendingInteractions,
    };
  }

  return {
    pendingInteraction: state.pendingInteractions[pendingIndex],
    pendingInteractions: [
      ...state.pendingInteractions.slice(0, pendingIndex),
      ...state.pendingInteractions.slice(pendingIndex + 1),
    ],
  };
}

function getOldestPendingInteractionAt(
  pendingInteractions: PendingInteraction[],
): number | null {
  return pendingInteractions.length > 0
    ? pendingInteractions[0].receivedAt
    : null;
}

function findInFlightInteractionIndex(
  inFlightInteractions: InFlightInteraction[],
  context?: string,
): number {
  if (!context) {
    return inFlightInteractions.length > 0 ? 0 : -1;
  }

  return inFlightInteractions.findIndex((inFlight) =>
    context === inFlight.context || context.startsWith(`${inFlight.context}:`),
  );
}

function getOldestAcknowledgedInteractionAt(
  inFlightInteractions: InFlightInteraction[],
): number | null {
  const acknowledgedAt = inFlightInteractions
    .map((inFlight) => inFlight.acknowledgedAt)
    .filter((value): value is number => value !== null);

  return acknowledgedAt.length > 0 ? Math.min(...acknowledgedAt) : null;
}

export function recordInteractionReceived(
  state: BotHealthState,
  now: number,
  context = "unknown",
): BotHealthState {
  const pendingInteractions = [
    ...state.pendingInteractions,
    {
      context,
      receivedAt: now,
    },
  ];
  const inFlightInteractions = [
    ...state.inFlightInteractions,
    {
      context,
      receivedAt: now,
      acknowledgedAt: null,
    },
  ];

  return {
    ...state,
    lastInteractionReceivedAt: now,
    oldestPendingInteractionAt: getOldestPendingInteractionAt(
      pendingInteractions,
    ),
    pendingInteractionCount: pendingInteractions.length,
    pendingInteractions,
    inFlightInteractionCount: inFlightInteractions.length,
    inFlightInteractions,
  };
}

export function recordAckSuccess(
  state: BotHealthState,
  now: number,
  context = "unknown",
): BotHealthState {
  const { pendingInteraction, pendingInteractions } = completePendingInteraction(
    state,
    context,
  );
  const lastAckDurationMs = pendingInteraction
    ? now - pendingInteraction.receivedAt
    : null;
  const inFlightIndex = findInFlightInteractionIndex(
    state.inFlightInteractions,
    context,
  );
  const inFlightInteractions = inFlightIndex < 0
    ? state.inFlightInteractions
    : state.inFlightInteractions.map((inFlight, index) =>
      index === inFlightIndex
        ? { ...inFlight, acknowledgedAt: now }
        : inFlight,
    );

  return {
    ...state,
    lastAckSucceededAt: now,
    lastAckDurationMs,
    maxAckDurationMs: lastAckDurationMs === null
      ? state.maxAckDurationMs
      : Math.max(state.maxAckDurationMs ?? 0, lastAckDurationMs),
    lastAckContext: context,
    consecutiveAckFailures: 0,
    pendingInteractionCount: pendingInteractions.length,
    pendingInteractions,
    oldestPendingInteractionAt: getOldestPendingInteractionAt(
      pendingInteractions,
    ),
    oldestAcknowledgedInteractionAt: getOldestAcknowledgedInteractionAt(
      inFlightInteractions,
    ),
    inFlightInteractionCount: inFlightInteractions.length,
    inFlightInteractions,
  };
}

export function recordAckFailure(
  state: BotHealthState,
  _now: number,
  context = "unknown",
): BotHealthState {
  const { pendingInteractions } = completePendingInteraction(state, context);
  const inFlightIndex = findInFlightInteractionIndex(
    state.inFlightInteractions,
    context,
  );
  const inFlightInteractions = inFlightIndex < 0
    ? state.inFlightInteractions
    : [
      ...state.inFlightInteractions.slice(0, inFlightIndex),
      ...state.inFlightInteractions.slice(inFlightIndex + 1),
    ];

  return {
    ...state,
    consecutiveAckFailures: state.consecutiveAckFailures + 1,
    lastAckFailureContext: context,
    pendingInteractionCount: pendingInteractions.length,
    pendingInteractions,
    oldestPendingInteractionAt: getOldestPendingInteractionAt(
      pendingInteractions,
    ),
    oldestAcknowledgedInteractionAt: getOldestAcknowledgedInteractionAt(
      inFlightInteractions,
    ),
    inFlightInteractionCount: inFlightInteractions.length,
    inFlightInteractions,
  };
}

export function recordInteractionCompleted(
  state: BotHealthState,
  context: string,
): BotHealthState {
  const inFlightIndex = findInFlightInteractionIndex(
    state.inFlightInteractions,
    context,
  );

  if (inFlightIndex < 0) {
    return state;
  }

  const inFlightInteractions = [
    ...state.inFlightInteractions.slice(0, inFlightIndex),
    ...state.inFlightInteractions.slice(inFlightIndex + 1),
  ];

  return {
    ...state,
    oldestAcknowledgedInteractionAt: getOldestAcknowledgedInteractionAt(
      inFlightInteractions,
    ),
    inFlightInteractionCount: inFlightInteractions.length,
    inFlightInteractions,
  };
}

export function recordGatewayReady(
  state: BotHealthState,
  now: number,
): BotHealthState {
  return {
    ...state,
    lastGatewayReadyAt: now,
    lastGatewayDisconnectAt: null,
  };
}

export function recordGatewayDisconnect(
  state: BotHealthState,
  now: number,
): BotHealthState {
  return {
    ...state,
    lastGatewayDisconnectAt: now,
  };
}

export function recordGatewayResume(
  state: BotHealthState,
  now: number,
): BotHealthState {
  return {
    ...recordGatewayReady(state, now),
    lastGatewayResumeAt: now,
  };
}

export function recordGatewayReconnect(
  state: BotHealthState,
  now: number,
): BotHealthState {
  return {
    ...state,
    lastGatewayReconnectAt: now,
  };
}

export function recordWatchdogTick(
  state: BotHealthState,
  now: number,
  previousTickAt: number,
  intervalMs: number,
): BotHealthState {
  const expectedTickAt = previousTickAt + intervalMs;
  const lastWatchdogLagMs = Math.max(0, now - expectedTickAt);

  return {
    ...state,
    lastWatchdogLagMs,
    maxWatchdogLagMs: Math.max(state.maxWatchdogLagMs ?? 0, lastWatchdogLagMs),
  };
}

export function shouldRestartFromHealthState(
  state: BotHealthState,
  now: number,
  thresholds: BotHealthThresholds,
): BotHealthDecision {
  if (
    state.oldestPendingInteractionAt !== null &&
    now - state.oldestPendingInteractionAt >= thresholds.ackTimeoutMs
  ) {
    return {
      shouldRestart: true,
      reason: "interaction_ack_timeout",
    };
  }

  if (
    state.oldestAcknowledgedInteractionAt !== null &&
    now - state.oldestAcknowledgedInteractionAt >= thresholds.handlerTimeoutMs
  ) {
    return {
      shouldRestart: true,
      reason: "interaction_handler_timeout",
    };
  }

  if (state.consecutiveAckFailures >= thresholds.maxConsecutiveAckFailures) {
    return {
      shouldRestart: true,
      reason: "consecutive_ack_failures",
    };
  }

  if (
    state.lastGatewayDisconnectAt !== null &&
    now - state.lastGatewayDisconnectAt >= thresholds.gatewayDisconnectTimeoutMs
  ) {
    return {
      shouldRestart: true,
      reason: "gateway_disconnect_timeout",
    };
  }

  return { shouldRestart: false };
}

function getThresholdsFromEnv(): BotHealthThresholds {
  return {
    ackTimeoutMs: normalizePollingIntervalMs(
      process.env.BOT_HEALTH_ACK_TIMEOUT_MS,
      DEFAULT_ACK_TIMEOUT_MS,
    ),
    handlerTimeoutMs: normalizePollingIntervalMs(
      process.env.BOT_HEALTH_HANDLER_TIMEOUT_MS,
      DEFAULT_HANDLER_TIMEOUT_MS,
    ),
    gatewayDisconnectTimeoutMs: normalizePollingIntervalMs(
      process.env.BOT_HEALTH_GATEWAY_DISCONNECT_TIMEOUT_MS,
      DEFAULT_GATEWAY_DISCONNECT_TIMEOUT_MS,
    ),
    maxConsecutiveAckFailures: normalizePositiveInteger(
      process.env.BOT_HEALTH_MAX_CONSECUTIVE_ACK_FAILURES,
      DEFAULT_MAX_CONSECUTIVE_ACK_FAILURES,
      1,
    ),
  };
}

function getHealthCheckIntervalMs(): number {
  return normalizePollingIntervalMs(
    process.env.BOT_HEALTH_CHECK_INTERVAL_MS,
    DEFAULT_HEALTH_CHECK_INTERVAL_MS,
    15_000,
  );
}

export class BotHealthMonitor {
  private static state = createInitialBotHealthState();
  private static watchdogTimer: NodeJS.Timeout | null = null;
  private static restartRequested = false;
  private static lastWatchdogTickAt: number | null = null;

  static recordInteractionReceived(context: string) {
    this.state = recordInteractionReceived(this.state, Date.now(), context);
    console.log(`[BotHealthMonitor] interaction received: ${context}`);
  }

  static recordAckSuccess(context: string) {
    this.state = recordAckSuccess(this.state, Date.now(), context);
    console.log("[BotHealthMonitor] interaction ack succeeded", {
      context,
      ackDurationMs: this.state.lastAckDurationMs,
      pendingInteractionCount: this.state.pendingInteractionCount,
    });
  }

  static recordAckFailure(context: string, error: unknown) {
    this.state = recordAckFailure(this.state, Date.now(), context);
    console.error(`[BotHealthMonitor] interaction ack failed: ${context}`, error);
  }

  static recordInteractionCompleted(context: string) {
    this.state = recordInteractionCompleted(this.state, context);
  }

  static recordGatewayReady(source: string) {
    this.state = recordGatewayReady(this.state, Date.now());
    console.log(`[BotHealthMonitor] gateway ready: ${source}`);
  }

  static recordGatewayDisconnect(source: string, error: unknown) {
    this.state = recordGatewayDisconnect(this.state, Date.now());
    console.error(`[BotHealthMonitor] gateway disconnected: ${source}`, error);
  }

  static recordGatewayReconnect(source: string) {
    this.state = recordGatewayReconnect(this.state, Date.now());
    console.warn(`[BotHealthMonitor] gateway reconnecting: ${source}`);
  }

  static recordGatewayResume(source: string) {
    this.state = recordGatewayResume(this.state, Date.now());
    console.log(`[BotHealthMonitor] gateway resumed: ${source}`);
  }

  static startWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
    }

    const intervalMs = getHealthCheckIntervalMs();
    this.lastWatchdogTickAt = Date.now();

    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      this.state = recordWatchdogTick(
        this.state,
        now,
        this.lastWatchdogTickAt ?? now,
        intervalMs,
      );
      this.lastWatchdogTickAt = now;

      if ((this.state.lastWatchdogLagMs ?? 0) >= 1_000) {
        console.warn("[BotHealthMonitor] watchdog tick delayed", {
          lagMs: this.state.lastWatchdogLagMs,
          maxLagMs: this.state.maxWatchdogLagMs,
          pendingInteractionCount: this.state.pendingInteractionCount,
        });
      }

      const thresholds = getThresholdsFromEnv();
      const decision = shouldRestartFromHealthState(
        this.state,
        now,
        thresholds,
      );

      if (!decision.shouldRestart || this.restartRequested) {
        return;
      }

      this.restartRequested = true;
      console.error(
        `[BotHealthMonitor] restart requested due to ${decision.reason}`,
        this.state,
      );
      process.exit(1);
    }, intervalMs);
  }
}
