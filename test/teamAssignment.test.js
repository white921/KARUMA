const test = require("node:test");
const assert = require("node:assert/strict");
const { ButtonStyle, MessageFlags } = require("discord.js");

const {
  ROLE_IDS,
  THREAD_IDS,
} = require("../dist/constant/shared/id.js");
const {
  TEAM_ASSIGNMENT_PANEL_CHANNEL_ID,
  TEAM_ASSIGNMENT_PREFIX,
  TEAM_ASSIGNMENTS,
  createTeamAssignmentCustomId,
} = require("../dist/constant/member/teamAssignment.js");
const {
  createTeamAssignmentPanelPayload,
} = require("../dist/panel/member/teamAssignmentPanelService.js");
const {
  TeamAssignmentService,
} = require("../dist/service/member/teamAssignmentService.js");
const {
  handlePanelButton,
} = require("../dist/handler/interaction/panelButtonHandler.js");
const {
  shouldDeferButtonUpdate,
} = require("../dist/util/interaction/interactionAck.js");
const {
  AccountService,
} = require("../dist/service/account/accountService.js");

test.beforeEach(() => TeamAssignmentService.confirmations.clear());

function modalInteraction(team, passphrase, userId = "user") {
  const replies = [];
  return {
    customId: createTeamAssignmentCustomId("modal", team),
    user: { id: userId },
    guildId: "guild",
    channelId: TEAM_ASSIGNMENT_PANEL_CHANNEL_ID,
    fields: { getTextInputValue: () => passphrase },
    replies,
    reply: async (body) => replies.push(body),
  };
}

function confirmationInteraction(customId, {
  userId = "user",
  guildId = "guild",
  channelId = TEAM_ASSIGNMENT_PANEL_CHANNEL_ID,
  heldRoleIds = [],
} = {}) {
  const edits = [];
  const added = [];
  const removed = [];
  const roleIds = new Set(heldRoleIds);
  const roles = new Map([
    [ROLE_IDS.TEAM_RED, { id: ROLE_IDS.TEAM_RED, name: "紅組", editable: true }],
    [ROLE_IDS.TEAM_BLUE, { id: ROLE_IDS.TEAM_BLUE, name: "蒼組", editable: true }],
  ]);
  const member = {
    roles: {
      cache: { has: (id) => roleIds.has(id) },
      add: async (role) => { added.push(role.id); roleIds.add(role.id); },
      remove: async (role) => { removed.push(role.id); roleIds.delete(role.id); },
    },
  };
  return {
    customId,
    user: { id: userId },
    guildId,
    channelId,
    guild: {
      members: { fetch: async (id) => { assert.equal(id, userId); return member; } },
      roles: { fetch: async (id) => roles.get(id) },
    },
    edits,
    added,
    removed,
    roleIds,
    editReply: async (body) => edits.push(body),
  };
}

async function createConfirmation(team = "red", passphrase = "あか", userId = "user") {
  const modal = modalInteraction(team, passphrase, userId);
  await TeamAssignmentService.submitPassphrase(modal);
  const buttons = modal.replies[0].components?.[0].toJSON().components ?? [];
  return { modal, confirmId: buttons[0]?.custom_id, cancelId: buttons[1]?.custom_id };
}

test("panel shows the exact red and blue team buttons", () => {
  assert.equal(TEAM_ASSIGNMENT_PANEL_CHANNEL_ID, THREAD_IDS.TEAM_ASSIGNMENT_PANEL);
  assert.deepEqual(
    [TEAM_ASSIGNMENTS.red.roleId, TEAM_ASSIGNMENTS.blue.roleId],
    [ROLE_IDS.TEAM_RED, ROLE_IDS.TEAM_BLUE],
  );
  const payload = createTeamAssignmentPanelPayload();
  const buttons = payload.components[0].toJSON().components;
  assert.deepEqual(buttons.map((button) => button.label), ["紅組", "蒼組"]);
  assert.deepEqual(buttons.map((button) => button.custom_id), [
    createTeamAssignmentCustomId("select", "red"),
    createTeamAssignmentCustomId("select", "blue"),
  ]);
  assert.deepEqual(buttons.map((button) => button.style), [
    ButtonStyle.Danger,
    ButtonStyle.Primary,
  ]);
});

test("team button opens a passphrase modal before the account requirement", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => {
    throw new Error("account check must not run");
  });
  let modal;
  await handlePanelButton({
    customId: createTeamAssignmentCustomId("select", "red"),
    channelId: TEAM_ASSIGNMENT_PANEL_CHANNEL_ID,
    showModal: async (value) => { modal = value.toJSON(); },
  });
  assert.equal(modal.title, "紅組のあいことば");
  assert.equal(modal.custom_id, createTeamAssignmentCustomId("modal", "red"));
  assert.equal(modal.components[0].components[0].custom_id, "passphrase");
});

test("wrong passphrase remains private and creates no confirmation", async () => {
  const modal = modalInteraction("blue", "あか");
  await TeamAssignmentService.submitPassphrase(modal);
  assert.match(modal.replies[0].content, /違います/);
  assert.equal(modal.replies[0].flags, MessageFlags.Ephemeral);
  assert.equal(TeamAssignmentService.confirmations.size, 0);
});

test("correct passphrase shows a private confirmation without changing roles", async () => {
  const { modal, confirmId, cancelId } = await createConfirmation("blue", " あお ");
  assert.equal(modal.replies[0].flags, MessageFlags.Ephemeral);
  assert.match(modal.replies[0].embeds[0].toJSON().description, /蒼組/);
  assert.match(confirmId, new RegExp(`^${TEAM_ASSIGNMENT_PREFIX}:confirm:`));
  assert.match(cancelId, new RegExp(`^${TEAM_ASSIGNMENT_PREFIX}:cancel:`));
  assert.equal(shouldDeferButtonUpdate(confirmId), true);
  assert.equal(shouldDeferButtonUpdate(cancelId), true);
});

test("confirmation adds the selected role, removes the opposite role, and cannot replay", async () => {
  const { confirmId } = await createConfirmation("red", "あか");
  const interaction = confirmationInteraction(confirmId, {
    heldRoleIds: [ROLE_IDS.TEAM_BLUE],
  });
  await TeamAssignmentService.handleConfirmation(interaction);
  assert.deepEqual(interaction.added, [ROLE_IDS.TEAM_RED]);
  assert.deepEqual(interaction.removed, [ROLE_IDS.TEAM_BLUE]);
  assert.deepEqual([...interaction.roleIds], [ROLE_IDS.TEAM_RED]);
  assert.match(interaction.edits[0].content, /紅組に参加/);
  assert.equal(interaction.edits[0].components.length, 0);
  await assert.rejects(
    TeamAssignmentService.handleConfirmation(interaction),
    /期限切れ/,
  );
});

test("confirmation is bound to its user, guild, and panel channel", async () => {
  const { confirmId } = await createConfirmation("red", "あか", "owner");
  await assert.rejects(
    TeamAssignmentService.handleConfirmation(
      confirmationInteraction(confirmId, { userId: "other" }),
    ),
    /期限切れ/,
  );
  await assert.rejects(
    TeamAssignmentService.handleConfirmation(
      confirmationInteraction(confirmId, { userId: "owner", guildId: "other" }),
    ),
    /期限切れ/,
  );
  await assert.rejects(
    TeamAssignmentService.handleConfirmation(
      confirmationInteraction(confirmId, { userId: "owner", channelId: "other" }),
    ),
    /期限切れ/,
  );

  const owner = confirmationInteraction(confirmId, { userId: "owner" });
  await TeamAssignmentService.handleConfirmation(owner);
  assert.deepEqual(owner.added, [ROLE_IDS.TEAM_RED]);
});

test("cancel consumes the confirmation without changing roles", async () => {
  const { cancelId } = await createConfirmation("blue", "あお");
  const interaction = confirmationInteraction(cancelId);
  await TeamAssignmentService.handleConfirmation(interaction);
  assert.deepEqual(interaction.added, []);
  assert.deepEqual(interaction.removed, []);
  assert.match(interaction.edits[0].content, /キャンセル/);
  await assert.rejects(
    TeamAssignmentService.handleConfirmation(interaction),
    /期限切れ/,
  );
});

test("team selection can only start in the assigned panel thread", async () => {
  await assert.rejects(
    TeamAssignmentService.showPassphraseModal({
      customId: createTeamAssignmentCustomId("select", "red"),
      channelId: "other",
      showModal: async () => {},
    }),
    /チーム分けパネル/,
  );
});
