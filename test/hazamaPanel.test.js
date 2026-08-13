const test = require("node:test");
const assert = require("node:assert/strict");

const { HAZAMA_PRICE } = require("../dist/constant/hazama.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { HAZAMA_PANEL_MESSAGES } = require("../dist/constant/panel.js");
const { createHazamaPanelActionRow } = require("../dist/service/hazamaPanelService.js");
const { HazamaService } = require("../dist/service/hazamaService.js");
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require("../dist/constant/id.js");

test("hazama panel uses the configured payment channel and access role", () => {
  assert.equal(TEXT_CHANNEL_IDS.HAZAMA_PANEL, "1536053027851739289");
  assert.equal(ROLE_IDS.HAZAMA_ACCESS, "1537455098945343651");
  assert.equal(HAZAMA_PRICE, 1000);
  assert.match(HAZAMA_PANEL_MESSAGES.DESCRIPTION, /1,000LIA／12時間/);

  const button = createHazamaPanelActionRow().toJSON().components[0];
  assert.equal(button.custom_id, PANEL_COMMAND_NAMES.HAZAMA_ACCESS);
});

test("hazama staff and leader can use the panel without payment", async () => {
  const memberWithRole = (roleId) => ({ roles: { cache: new Set([roleId]) } });

  assert.equal(await HazamaService.isFree(memberWithRole(ROLE_IDS.HAZAMA_STAFF)), true);
  assert.equal(await HazamaService.isFree(memberWithRole(ROLE_IDS.HAZAMA_LEADER)), true);
  assert.equal(await HazamaService.isFree(memberWithRole("unrelated-role")), false);
});
