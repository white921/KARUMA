// Railway SSH上で実行: node scripts/release-competition-entry-panel.cjs --install
const assert = require("node:assert/strict");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  COMPETITION_ENTRY_ACTIONS,
  COMPETITION_ENTRY_PANEL_CHANNEL_ID,
} = require("../dist/constant/member/competitionEntry");
const {
  CompetitionEntryPanelService,
} = require("../dist/panel/member/competitionEntryPanelService");

const timeout = setTimeout(() => {
  console.error("Competition entry panel release timed out");
  process.exit(1);
}, 60_000);

(async () => {
  assert(process.argv.includes("--install"), "Choose --install");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const ready = new Promise((resolve) => client.once("clientReady", resolve));
  try {
    await client.login(process.env.DISCORD_TOKEN);
    await ready;
    const message = await CompetitionEntryPanelService.createPanel(client);
    const actual = await message.fetch();
    const buttons = actual.components.flatMap((row) => row.components);
    assert.equal(actual.channelId, COMPETITION_ENTRY_PANEL_CHANNEL_ID);
    assert.deepEqual(
      buttons.map((button) => button.customId),
      [COMPETITION_ENTRY_ACTIONS.OPEN, COMPETITION_ENTRY_ACTIONS.REVIEW],
    );
    console.log(JSON.stringify({
      panelUrl: actual.url,
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
