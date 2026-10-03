const test = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("discord.js");
const {
  BotHealthMonitor,
  createInitialBotHealthState,
  shouldRestartFromHealthState,
} = require("../dist/service/system/botHealthMonitor");
const { PaymentConfirmationService } = require("../dist/service/currency/paymentConfirmationService");

const thresholds = {
  ackTimeoutMs: 30_000,
  handlerTimeoutMs: 45_000,
  gatewayDisconnectTimeoutMs: 300_000,
  maxConsecutiveAckFailures: 3,
};

function eventEntry(t) {
  let handler;
  t.mock.method(Client.prototype, "on", function (event, callback) {
    if (event === "interactionCreate") handler = callback;
    return this;
  });
  t.mock.method(Client.prototype, "login", async () => "test");
  t.mock.method(console, "log", () => {});
  BotHealthMonitor.state = createInitialBotHealthState();
  delete require.cache[require.resolve("../dist/index")];
  require("../dist/index");
  assert.ok(handler);
  return handler;
}

function sendModalInteraction() {
  const calls = [];
  return {
    customId: "send_payer_recipient",
    id: "send-modal-interaction",
    user: { id: "payer" },
    guildId: "guild",
    channelId: "channel",
    deferred: false,
    replied: false,
    fields: {
      fields: new Map([["amount", {}], ["comment", {}]]),
      getTextInputValue(fieldId) {
        return fieldId === "amount" ? "100" : "test";
      },
    },
    calls,
    isChatInputCommand: () => false,
    isButton: () => false,
    isUserSelectMenu: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => true,
    async deferReply() {
      assert.equal(this.deferred, false, "must not acknowledge twice");
      this.deferred = true;
      calls.push("deferReply");
    },
    async editReply() {
      calls.push("editReply");
    },
    async reply() {
      this.replied = true;
      calls.push("reply");
    },
  };
}

test("send confirmation modal records its nested deferReply and cannot trigger a false ACK timeout", async (t) => {
  t.after(() => PaymentConfirmationService.sessions.clear());
  const handle = eventEntry(t);
  const interaction = sendModalInteraction();

  await handle(interaction);

  assert.deepEqual(interaction.calls, ["deferReply", "editReply"]);
  assert.equal(BotHealthMonitor.state.pendingInteractionCount, 0);
  assert.equal(BotHealthMonitor.state.inFlightInteractionCount, 0);
  assert.deepEqual(
    shouldRestartFromHealthState(
      BotHealthMonitor.state,
      Date.now() + 60_000,
      thresholds,
    ),
    { shouldRestart: false },
  );
});
