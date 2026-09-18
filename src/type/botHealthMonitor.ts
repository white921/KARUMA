export type PendingInteraction = {
  context: string;
  receivedAt: number;
};

export type InFlightInteraction = {
  context: string;
  receivedAt: number;
  acknowledgedAt: number | null;
  handlerTimeoutMs?: number;
};

export type InteractionHealthOptions = {
  handlerTimeoutMs?: number;
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
