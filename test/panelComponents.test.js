const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionsBitField } = require("discord.js");

const { ROLE_IDS, TEXT_CHANNEL_IDS } = require("../dist/constant/shared/id.js");
const { CURRENCY_NAMES } = require("../dist/constant/currency/currency.js");
const { HOTEL_MESSAGES, HOTEL_TYPE_NAMES } = require("../dist/constant/hotel/hotel.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const { AccountService } = require("../dist/service/account/accountService.js");
const { createBankPanelActionRow } = require("../dist/panel/currency/panelService.js");
const { createAdminPanelActionRow } = require("../dist/panel/currency/adminPanelService.js");
const { createCasinoPanelActionRow } = require("../dist/panel/casino/casinoPanel.js");
const { createDiaryPanelActionRow } = require("../dist/panel/diary/diaryPanelService.js");
const { createGamePanelActionRows } = require("../dist/panel/game/gamePanelService.js");
const { createHazamaPanelActionRow } = require("../dist/panel/vc/hazamaPanelService.js");
const { createHotelVcPanelActionRows } = require("../dist/panel/hotel/hotelPanelService.js");
const { HotelVcService } = require("../dist/service/hotel/hotelVcService.js");
const { createRedeployPanelActionRow } = require("../dist/panel/system/redeployPanelService.js");
const {
  createDarkShopPanelActionRow,
  createShopPanelActionRow,
} = require("../dist/panel/market/shopPanelService.js");
const { createCreatorEmblemPanelActionRow } = require("../dist/panel/market/creatorEmblemPanelService.js");
const { CreatorEmblemPaymentService } = require("../dist/service/market/creatorEmblemPaymentService.js");
const { VcPanelService } = require("../dist/panel/vc/vcPanelService.js");
const {
  GAME_PANEL_MESSAGES,
  HOTEL_VC_PANEL_MESSAGES,
  PANEL_MESSAGES,
  CASINO_PANEL_MESSAGES,
  CREATOR_EMBLEM_PANEL_MESSAGES,
  DIARY_PANEL_MESSAGES,
  DARK_SHOP_PANEL_MESSAGES,
} = require("../dist/constant/panel/panel.js");

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

test("panel descriptions do not recommend smartphone operation", () => {
  for (const description of [
    PANEL_MESSAGES.DESCRIPTION,
    HOTEL_VC_PANEL_MESSAGES.DESCRIPTION,
    HOTEL_VC_PANEL_MESSAGES.NORMAL_DESCRIPTION,
    HOTEL_VC_PANEL_MESSAGES.SPECIAL_DISCRIPTION,
    CASINO_PANEL_MESSAGES.DESCRIPTION,
    GAME_PANEL_MESSAGES.DESCRIPTION,
  ]) {
    assert.doesNotMatch(description, /スマートフォンでの操作を推奨しています。/);
  }
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

test("creator emblem panel enables fixed-recipient stamp payments", () => {
  const buttons = createCreatorEmblemPanelActionRow().toJSON().components;
  const buttonIds = buttons.map((button) => button.custom_id);

  assert.deepEqual(buttonIds, [
    PANEL_COMMAND_NAMES.CREATOR_EMBLEM_PAY,
    PANEL_COMMAND_NAMES.VIEW,
  ]);
  assert.equal(buttons[0].disabled, false);
});

test("creator emblem pricing follows noble and knight prices", () => {
  const noble = memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.HONMEN]);
  const knight = memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN]);
  assert.equal(CreatorEmblemPaymentService.getPriceForMember(noble, "personal"), 60000);
  assert.equal(CreatorEmblemPaymentService.getPriceForMember(noble, "large"), 200000);
  assert.equal(CreatorEmblemPaymentService.getPriceForMember(knight, "personal"), 100000);
  assert.throws(() => CreatorEmblemPaymentService.getPriceForMember(knight, "large"), /貴族のみ/);
  assert.throws(() => CreatorEmblemPaymentService.getPriceForMember(
    memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN]), "personal"), /貴族または騎士/);
});

test("creator emblem panel explains product prices", () => {
  const description = CREATOR_EMBLEM_PANEL_MESSAGES.DESCRIPTION;
  assert.match(description, /貴族：60,000 LIA/);
  assert.match(description, /騎士：100,000 LIA/);
  assert.match(description, /貴族のみ：200,000 LIA/);
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
    require("../dist/constant/panel/panel.js").SHOP_PANEL_MESSAGES.DESCRIPTION,
    new RegExp(`<#${TEXT_CHANNEL_IDS.MARKET_INFO}>`),
  );
  assert.doesNotMatch(
    require("../dist/constant/panel/panel.js").SHOP_PANEL_MESSAGES.DESCRIPTION,
    /旧市場チケット/,
  );
});

test("dark market panel links the LEVELIA dark market product list", () => {
  assert.equal(DARK_SHOP_PANEL_MESSAGES.TITLE, "闇市場パネル");
  assert.match(
    DARK_SHOP_PANEL_MESSAGES.DESCRIPTION,
    /\[闇市商品一覧\]\(https:\/\/discord\.com\/channels\/1534636292153807039\/1534644437328728164\)/,
  );
  assert.match(DARK_SHOP_PANEL_MESSAGES.DESCRIPTION, /各20,000 LIA（購入対象：全員）/);
  assert.match(DARK_SHOP_PANEL_MESSAGES.DESCRIPTION, /匿名で相手専用のTC/);
  assert.doesNotMatch(DARK_SHOP_PANEL_MESSAGES.DESCRIPTION, /準備中/);
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
  assert.equal(GAME_PANEL_MESSAGES.PASS_TWO_WEEKS, "ゲームパス（2週間）");
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /^遊戯パネルです。24時間有効な遊戯VCを作成できます。/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /遊戯パネルです。/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /【遊戯案内】/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /ゲームパス/);
  assert.doesNotMatch(GAME_PANEL_MESSAGES.DESCRIPTION, /戯境/);
});

test("normal hotel panel description does not repeat shared guidance", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.equal(typeof description, "string");
  assert.equal((description.match(/「通常ホテル」ボタンを押してVCを作成してください。/g) ?? []).length, 1);
  assert.equal((description.match(/【ホテル案内】/g) ?? []).length, 1);
});

test("normal hotel panel description has no unintended leading spaces", () => {
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
  assert.doesNotMatch(description, /VIP|フリーダム|24時間/);
  assert.match(HOTEL_VC_PANEL_MESSAGES.SPECIAL_DISCRIPTION, /12時間：30,000LIA ／ 24時間：50,000LIA/);
  assert.match(HOTEL_VC_PANEL_MESSAGES.SPECIAL_DISCRIPTION, /12時間：50,000LIA ／ 24時間：90,000LIA/);
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

test("freedom hotels explicitly hide restricted roles while preserving owner and sub access", async () => {
  const originalGetSubUserId = AccountService.getSubUserIdByMainUserId;
  const createdChannelOptions = [];
  const hiddenRoleIds = [
    ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN,
    ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI,
    ROLE_IDS.DETENTION_ROLES.SUMMONED_CRIME,
  ];
  const categoryOverwrites = new Map(hiddenRoleIds.slice(0, 2).map((id) => [id, {
    id,
    type: 0,
    allow: new PermissionsBitField([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.Speak,
    ]),
    deny: new PermissionsBitField([PermissionsBitField.Flags.Stream]),
  }]));

  AccountService.getSubUserIdByMainUserId = async () => "creator-sub";

  try {
    const guild = {
      channels: {
        fetch: async () => ({ permissionOverwrites: { cache: categoryOverwrites } }),
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
    for (const roleId of hiddenRoleIds) {
      const matches = options.permissionOverwrites.filter((overwrite) => overwrite.id === roleId);
      assert.equal(matches.length, 1);
      const allow = new PermissionsBitField(matches[0].allow);
      const deny = new PermissionsBitField(matches[0].deny);
      assert.equal(allow.has(PermissionsBitField.Flags.ViewChannel), false);
      assert.equal(deny.has(PermissionsBitField.Flags.ViewChannel), true);
      if (categoryOverwrites.has(roleId)) {
        assert.equal(allow.has(PermissionsBitField.Flags.Speak), true);
        assert.equal(deny.has(PermissionsBitField.Flags.Stream), true);
      }
    }
    for (const userId of ["creator", "creator-sub"]) {
      const overwrite = options.permissionOverwrites.find((entry) => entry.id === userId);
      const allow = new PermissionsBitField(overwrite.allow);
      assert.equal(allow.has(PermissionsBitField.Flags.ViewChannel), true);
      assert.equal(allow.has(PermissionsBitField.Flags.ManageChannels), true);
    }
  }
});
