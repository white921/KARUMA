// Railway SSH上で実行: node scripts/release-team-assignment-panel.cjs --install
const assert = require("node:assert/strict");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  TEAM_ASSIGNMENT_PANEL_CHANNEL_ID,
  TEAM_ASSIGNMENTS,
  createTeamAssignmentCustomId,
} = require("../dist/constant/member/teamAssignment");
const {
  TeamAssignmentPanelService,
} = require("../dist/panel/member/teamAssignmentPanelService");

const timeout = setTimeout(() => {
  console.error("Team assignment panel release timed out");
  process.exit(1);
}, 60_000);

(async () => {
  assert(process.argv.includes("--install"), "Choose --install");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const ready = new Promise((resolve) => client.once("clientReady", resolve));
  try {
    await client.login(process.env.DISCORD_TOKEN);
    await ready;
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const botMember = await guild.members.fetchMe();
    const botTopPosition = botMember.roles.highest.position;

    for (const assignment of Object.values(TEAM_ASSIGNMENTS)) {
      const role = await guild.roles.fetch(assignment.roleId);
      assert(role, `Missing role: ${assignment.label}`);
      assert.equal(role.name, assignment.label);
      assert(role.position < botTopPosition, `${assignment.label} is above the Bot role`);
    }

    const message = await TeamAssignmentPanelService.createPanel(client);
    const actual = await message.fetch();
    const buttons = actual.components.flatMap((row) => row.components);
    assert.equal(actual.channelId, TEAM_ASSIGNMENT_PANEL_CHANNEL_ID);
    assert.deepEqual(
      buttons.map((button) => button.customId),
      [
        createTeamAssignmentCustomId("select", "red"),
        createTeamAssignmentCustomId("select", "blue"),
      ],
    );
    console.log(JSON.stringify({
      panelUrl: actual.url,
      roles: Object.values(TEAM_ASSIGNMENTS).map(({ label, roleId }) => ({ label, roleId })),
      embed: actual.embeds[0].toJSON(),
      components: actual.components.map((row) => row.toJSON()),
    }));
  } finally {
    client.destroy();
    clearTimeout(timeout);
  }
})()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
