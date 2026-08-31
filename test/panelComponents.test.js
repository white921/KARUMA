const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionsBitField } = require("discord.js");

const { ROLE_IDS } = require("../dist/constant/id.js");
const { CURRENCY_NAMES } = require("../dist/constant/currency.js");
const { HOTEL_MESSAGES, HOTEL_TYPE_NAMES } = require("../dist/constant/hotel.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { AccountService } = require("../dist/service/accountService.js");
const { createBankPanelActionRow } = require("../dist/service/panelService.js");
const { createAdminPanelActionRow } = require("../dist/service/adminPanelService.js");
const { createCasinoPanelActionRow } = require("../dist/service/casinoPanel.js");
const { createDiaryPanelActionRow } = require("../dist/service/diaryPanelService.js");
const { createGamePanelActionRows } = require("../dist/service/gamePanelService.js");
const { createHazamaPanelActionRow } = require("../dist/service/hazamaPanelService.js");
const { createHotelVcPanelActionRows } = require("../dist/service/hotelPanelService.js");
const { HotelVcService } = require("../dist/service/hotelVcService.js");
const { createRedeployPanelActionRow } = require("../dist/service/redeployPanelService.js");
const {
  createDarkShopPanelActionRow,
  createShopPanelActionRow,
} = require("../dist/service/shopPanelService.js");
const { createCreatorEmblemPanelActionRow } = require("../dist/service/creatorEmblemPanelService.js");
const { CreatorEmblemPaymentService } = require("../dist/service/creatorEmblemPaymentService.js");
const { VcPanelService } = require("../dist/service/vcPanelService.js");
const {
  GAME_PANEL_MESSAGES,
  HOTEL_VC_PANEL_MESSAGES,
  PANEL_MESSAGES,
  CREATOR_EMBLEM_PANEL_MESSAGES,
  DIARY_PANEL_MESSAGES,
  DARK_SHOP_PANEL_MESSAGES,
} = require("../dist/constant/panel.js");

function memberWithRoles(roleIds) {
  return {
    roles: {
      cache: {
        has: (roleId) => roleIds.includes(roleId),
      },
    },
  };
}

test("bank panel title uses the LEVELIA bank label", () => {
  assert.equal(PANEL_MESSAGES.TITLE, "LEVELIA銀行窓口");
});

test("bank panel send button uses a Unicode emoji instead of a custom emoji id", () => {
  const row = createBankPanelActionRow().toJSON();
  const sendButton = row.components[1];

  assert.equal(sendButton.label, `${CURRENCY_NAMES}送金`);
  assert.equal(sendButton.emoji.name, "🪙");
  assert.equal(sendButton.emoji.id, undefined);
});

function assertButtonsHaveNoIcons(rows) {
  const buttons = rows.flatMap((row) => row.toJSON().components);

  assert.ok(buttons.length > 0);
  for (const button of buttons) {
    assert.equal(button.emoji, undefined);
  }
}

test("shop panel buttons do not use icons", () => {
  const row = createShopPanelActionRow().toJSON();
  const buttons = row.components;

  assert.ok(buttons.length > 0);
  for (const button of buttons) {
    assert.equal(button.emoji, undefined);
  }
});

test("shop purchase button uses the product purchase label", () => {
  const purchaseButton = createShopPanelActionRow()
    .toJSON()
    .components.find((button) => button.custom_id === PANEL_COMMAND_NAMES.SHOP_SEND);

  assert.equal(purchaseButton.label, "商品購入");
});

test("market and dark market use distinct purchase actions", () => {
  const marketButtonIds = createShopPanelActionRow()
    .toJSON()
    .components.map((button) => button.custom_id);
  const darkMarketButtonIds = createDarkShopPanelActionRow()
    .toJSON()
    .components.map((button) => button.custom_id);

  assert.ok(marketButtonIds.includes(PANEL_COMMAND_NAMES.SHOP_SEND));
  assert.ok(!marketButtonIds.includes(PANEL_COMMAND_NAMES.DARK_SHOP_SEND));
  assert.ok(darkMarketButtonIds.includes(PANEL_COMMAND_NAMES.DARK_SHOP_SEND));
  assert.ok(!darkMarketButtonIds.includes(PANEL_COMMAND_NAMES.SHOP_SEND));
  assert.ok(!darkMarketButtonIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_DRAW));
  assert.ok(!darkMarketButtonIds.includes(PANEL_COMMAND_NAMES.SHOP_TICKET_VIEW));
});

test("diary panel provides the LEVELIA VIP diary flow for 5000 LIA", () => {
  const buttonIds = createDiaryPanelActionRow()
    .toJSON()
    .components
    .map((button) => button.custom_id);

  assert.deepEqual(buttonIds, [
    PANEL_COMMAND_NAMES.DIARY_PUBLIC,
    PANEL_COMMAND_NAMES.VIEW,
  ]);
  assert.match(DIARY_PANEL_MESSAGES.DESCRIPTION, /日記作成: 5,000 LIA/);
  assert.doesNotMatch(DIARY_PANEL_MESSAGES.DESCRIPTION, /VIP機能/);
  assert.doesNotMatch(DIARY_PANEL_MESSAGES.DESCRIPTION, /スマートフォン/);
  assert.match(DIARY_PANEL_MESSAGES.DESCRIPTION, /3日間連続で投稿がない場合/);
  assert.match(DIARY_PANEL_MESSAGES.DESCRIPTION, /こちらのパネルでもう一度作成を行うと日記が再開されます/);
});

test("creator emblem panel disables payment while accepting orders is stopped", () => {
  const buttons = createCreatorEmblemPanelActionRow().toJSON().components;
  const buttonIds = buttons.map((button) => button.custom_id);

  assert.deepEqual(buttonIds, [
    PANEL_COMMAND_NAMES.CREATOR_EMBLEM_PAY,
    PANEL_COMMAND_NAMES.VIEW,
  ]);
  assert.equal(buttons[0].disabled, true);
});

test("creator emblem pricing treats noble and management roles equally", () => {
  const apostlePriceRoles = [
    ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
    ROLE_IDS.KANRISYA,
    ROLE_IDS.SABANUSI,
    ROLE_IDS.GIJUTU_LEADER,
  ];

  for (const roleId of apostlePriceRoles) {
    const member = memberWithRoles([roleId]);
    assert.equal(CreatorEmblemPaymentService.getPriceForMember(member, "personal"), 60000);
    assert.equal(CreatorEmblemPaymentService.getPriceForMember(member, "large"), 150000);
  }

  const congregationMember = memberWithRoles([
    ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN,
  ]);
  assert.equal(
    CreatorEmblemPaymentService.getPriceForMember(congregationMember, "personal"),
    100000,
  );
  assert.throws(
    () => CreatorEmblemPaymentService.getPriceForMember(congregationMember, "large"),
    /デカ紋章は貴族のみ利用できます。/,
  );
});

test("creator emblem panel explains that accepting orders is stopped", () => {
  const description = CREATOR_EMBLEM_PANEL_MESSAGES.DESCRIPTION;

  assert.match(description, /夢印工房の受付は停止中/);
  assert.doesNotMatch(description, /送金|料金/);
});

test("hotel and shop panels include their ticket confirmation buttons", () => {
  const hotelButtonIds = createHotelVcPanelActionRows()
    .flatMap((row) => row.toJSON().components)
    .map((button) => button.custom_id);
  const shopButtonIds = createShopPanelActionRow()
    .toJSON()
    .components
    .map((button) => button.custom_id);

  assert.ok(hotelButtonIds.includes(PANEL_COMMAND_NAMES.HOTEL_TICKET_VIEW));
  assert.ok(shopButtonIds.includes(PANEL_COMMAND_NAMES.SHOP_TICKET_VIEW));
});

test("shop panel starts the gacha flow from one button", () => {
  const shopButtonIds = createShopPanelActionRow()
    .toJSON()
    .components
    .map((button) => button.custom_id);

  assert.ok(shopButtonIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_DRAW));
  assert.ok(!shopButtonIds.includes(PANEL_COMMAND_NAMES.INVITE_POINT_GACHA_DRAW));
});

test("shop panel links the market gacha product list", () => {
  assert.match(
    require("../dist/constant/panel.js").SHOP_PANEL_MESSAGES.DESCRIPTION,
    /\[市場について\]\(https:\/\/discord\.com\/channels\/1534636292153807039\/1534644038248960231\)/,
  );
  assert.doesNotMatch(
    require("../dist/constant/panel.js").SHOP_PANEL_MESSAGES.DESCRIPTION,
    /旧市場チケット/,
  );
});

test("dark market panel links the LEVELIA dark market product list", () => {
  assert.equal(DARK_SHOP_PANEL_MESSAGES.TITLE, "闇市場パネル");
  assert.match(
    DARK_SHOP_PANEL_MESSAGES.DESCRIPTION,
    /https:\/\/discord\.com\/channels\/1534636292153807039\/1534638452086276209/,
  );
  assert.match(DARK_SHOP_PANEL_MESSAGES.DESCRIPTION, /匿名送信機能は準備中/);
  assert.match(DARK_SHOP_PANEL_MESSAGES.DESCRIPTION, /市場割引券は使用できません/);
});

test("non-bank panel buttons do not use icons", async () => {
  assertButtonsHaveNoIcons([createAdminPanelActionRow()]);
  assertButtonsHaveNoIcons([createCasinoPanelActionRow()]);
  assertButtonsHaveNoIcons([createDiaryPanelActionRow()]);
  assertButtonsHaveNoIcons(createGamePanelActionRows());
  assertButtonsHaveNoIcons([createHazamaPanelActionRow()]);
  assertButtonsHaveNoIcons([createRedeployPanelActionRow()]);

  const vcPanel = await VcPanelService.createVcPanel(true, true);
  assertButtonsHaveNoIcons(vcPanel.components);
});

test("teleport VC panel offers name and status changes", async () => {
  const panel = await VcPanelService.createVcPanel(false, true, true);
  const buttonIds = panel.components[0]
    .toJSON()
    .components.map((button) => button.custom_id);

  assert.deepEqual(buttonIds, [
    PANEL_COMMAND_NAMES.CHANGE_VC_NAME,
    PANEL_COMMAND_NAMES.CHANGE_VC_STATUS,
  ]);
});

test("hotel panel buttons do not use icons", () => {
  assertButtonsHaveNoIcons(createHotelVcPanelActionRows());
});

test("game panel copy uses LEVELIA's play category name", () => {
  assert.equal(GAME_PANEL_MESSAGES.TITLE, "遊戯パネル");
  assert.equal(GAME_PANEL_MESSAGES.GAME_PASS, "ゲームパス");
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /遊戯パネルです。/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /【遊戯案内】/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /ゲームパス/);
  assert.doesNotMatch(GAME_PANEL_MESSAGES.DESCRIPTION, /戯境/);
});

test("unified hotel panel description does not repeat shared guidance", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.equal(typeof description, "string");
  assert.equal((description.match(/ボタンを押してホテルを選択してください。/g) ?? []).length, 1);
  assert.equal((description.match(/【ホテル案内】/g) ?? []).length, 1);
});

test("unified hotel panel description has no unintended leading spaces", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.equal(typeof description, "string");
  const linesWithLeadingSpaces = description
    .split("\n")
    .filter((line) => line.startsWith(" "));

  assert.deepEqual(linesWithLeadingSpaces, []);
});

test("hotel panel summarizes the free tier as knight or above", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.equal(typeof description, "string");
  assert.match(description, /騎士以上：無料/);
  assert.doesNotMatch(description, /貴族以上：無料/);
  assert.doesNotMatch(description, /貴族・皇帝・英傑・侍従/);
  assert.doesNotMatch(description, /刻印/);
});

test("hotel panel duration labels match hour-based expiration", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.match(description, /旅人：10000LIA\/12時間/);
  assert.match(description, /賢者：5000LIA\/12時間/);
  assert.doesNotMatch(description, /\\n/);
  assert.match(description, /30000LIA\/12時間/);
  assert.match(description, /50000LIA\/24時間/);
  assert.match(description, /50000LIA\/12時間/);
  assert.match(description, /90000LIA\/24時間/);
  assert.doesNotMatch(description, /1分|2分/);
});

test("hotel ticket confirmation notice explains ticket priority", () => {
  assert.equal(
    HOTEL_MESSAGES.TICKET_PRIORITY_NOTICE,
    "※無料券を所持しているため、チケットを優先して消費します。",
  );
});

test("normal hotel is free for every eligible role", async () => {
  const eligibleRoleIds = [
    ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
    ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
    ROLE_IDS.SABANUSI,
    ROLE_IDS.KANRISYA,
  ];

  for (const roleId of eligibleRoleIds) {
    assert.equal(
      await HotelVcService.isNormalHotelBonusMember(memberWithRoles([roleId])),
      true,
    );
  }
  assert.equal(
    await HotelVcService.isNormalHotelBonusMember(
      memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN]),
    ),
    false,
  );
  assert.equal(
    await HotelVcService.isNormalHotelBonusMember(
      memberWithRoles([ROLE_IDS.EVALUATION_SUPPORT]),
    ),
    false,
  );
  assert.equal(await HotelVcService.isNormalHotelBonusMember(memberWithRoles([])), false);
});

test("normal hotel costs 5000 LIA for sages and 10000 LIA otherwise", async () => {
  assert.equal(
    await HotelVcService.getHotelVcPrice(
      PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL,
      memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN]),
    ),
    5000,
  );
  assert.equal(
    await HotelVcService.getHotelVcPrice(
      PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL,
      memberWithRoles([]),
    ),
    10000,
  );
});

test("freedom hotels initially hide the channel from believers", async () => {
  const originalGetSubUserId = AccountService.getSubUserIdByMainUserId;
  const createdChannelOptions = [];

  AccountService.getSubUserIdByMainUserId = async () => null;

  try {
    const guild = {
      channels: {
        fetch: async () => ({ permissionOverwrites: { cache: new Map() } }),
        create: async (options) => {
          createdChannelOptions.push(options);
          return { id: `freedom-${createdChannelOptions.length}`, send: async () => {} };
        },
      },
      members: { fetch: async (id) => ({ id, displayName: "作成者" }) },
    };
    const interaction = {
      guild,
      member: { id: "creator", displayName: "作成者" },
      user: { id: "creator" },
      channel: { parentId: "hotel-category" },
      deferred: false,
      reply: async () => {},
    };

    for (const hotelTypeName of [
      HOTEL_TYPE_NAMES.FREEDOM,
      HOTEL_TYPE_NAMES.FREEDOMLONG,
    ]) {
      await HotelVcService.createHotelVc(interaction, hotelTypeName, false);
    }
  } finally {
    AccountService.getSubUserIdByMainUserId = originalGetSubUserId;
  }

  assert.equal(createdChannelOptions.length, 2);
  for (const options of createdChannelOptions) {
    const believerOverwrite = options.permissionOverwrites.find(
      (overwrite) => overwrite.id === ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
    );

    assert.deepEqual(believerOverwrite.deny, [PermissionsBitField.Flags.ViewChannel]);
  }
});
