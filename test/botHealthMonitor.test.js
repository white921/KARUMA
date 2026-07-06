const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createInitialBotHealthState,
  recordInteractionReceived,
  recordAckSuccess,
  recordAckFailure,
  recordGatewayReady,
  recordGatewayDisconnect,
  recordWatchdogTick,
  shouldRestartFromHealthState,
} = require("../dist/service/botHealthMonitor.js");

const baseThresholds = {
  ackTimeoutMs: 30_000,
  gatewayDisconnectTimeoutMs: 300_000,
  maxConsecutiveAckFailures: 3,
};

test("does not restart while the bot is healthy", () => {
  let state = createInitialBotHealthState();
  state = recordGatewayReady(state, 1_000);
  state = recordInteractionReceived(state, 2_000, "command:view");
  state = recordAckSuccess(state, 2_100, "command:view:deferReply");

  const result = shouldRestartFromHealthState(state, 5_000, baseThresholds);

  assert.equal(result.shouldRestart, false);
});

test("restarts when an interaction stays unacked past the timeout", () => {
  let state = createInitialBotHealthState();
  state = recordGatewayReady(state, 1_000);
  state = recordInteractionReceived(state, 2_000, "command:view");

  const result = shouldRestartFromHealthState(state, 35_000, baseThresholds);

  assert.equal(result.shouldRestart, true);
  assert.equal(result.reason, "interaction_ack_timeout");
});

test("restarts after repeated ack failures", () => {
  let state = createInitialBotHealthState();
  state = recordGatewayReady(state, 1_000);
  state = recordInteractionReceived(state, 2_000, "command:view");
  state = recordAckFailure(state, 2_100, "command:view:deferReply");
  state = recordInteractionReceived(state, 3_000, "button:send");
  state = recordAckFailure(state, 3_100, "button:send:deferReply");
  state = recordInteractionReceived(state, 4_000, "modal:send");
  state = recordAckFailure(state, 4_100, "modal:send:reply");

  const result = shouldRestartFromHealthState(state, 5_000, baseThresholds);

  assert.equal(result.shouldRestart, true);
  assert.equal(result.reason, "consecutive_ack_failures");
});

test("restarts when the gateway stays disconnected for too long", () => {
  let state = createInitialBotHealthState();
  state = recordGatewayReady(state, 1_000);
  state = recordGatewayDisconnect(state, 2_000);

  const result = shouldRestartFromHealthState(state, 305_000, baseThresholds);

  assert.equal(result.shouldRestart, true);
  assert.equal(result.reason, "gateway_disconnect_timeout");
});

test("records ack duration and removes the matching pending interaction", () => {
  let state = createInitialBotHealthState();
  state = recordInteractionReceived(state, 1_000, "command:view");
  state = recordInteractionReceived(state, 2_000, "button:send");

  state = recordAckSuccess(state, 2_250, "button:send:deferReply");

  assert.equal(state.pendingInteractionCount, 1);
  assert.equal(state.oldestPendingInteractionAt, 1_000);
  assert.equal(state.lastAckDurationMs, 250);
  assert.equal(state.maxAckDurationMs, 250);
  assert.equal(state.lastAckContext, "button:send:deferReply");
});

test("records watchdog lag when the event loop delays the health timer", () => {
  let state = createInitialBotHealthState();

  state = recordWatchdogTick(state, 60_500, 0, 60_000);
  state = recordWatchdogTick(state, 122_000, 60_500, 60_000);

  assert.equal(state.lastWatchdogLagMs, 1_500);
  assert.equal(state.maxWatchdogLagMs, 1_500);
});
