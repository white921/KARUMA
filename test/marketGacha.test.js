const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MARKET_GACHA_DAILY_LIMIT,
  MARKET_GACHA_PRICE,
  MARKET_GACHA_PRIZES,
  selectMarketGachaPrize,
} = require("../dist/constant/market/marketGacha.js");
const {
  MarketGachaService,
  createMarketGachaConfirmationRow,
  createMarketGachaPaymentSelectionRow,
  formatMarketGachaDrawLog,
} = require("../dist/service/market/marketGachaService.js");
const { ROLE_IDS, TEXT_CHANNEL_IDS, THREAD_IDS } = require("../dist/constant/shared/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const { DbService } = require("../dist/service/system/dbService.js");
const { GachaCoinActivationService } = require("../dist/service/market/gachaCoinActivationService.js");

function memberWithRoles(roleIds) {
  return { roles: { cache: { has: (roleId) => roleIds.includes(roleId) } } };
}

function prize(key) {
  const value = MARKET_GACHA_PRIZES.find((item) => item.key === key);
  assert.ok(value, `missing prize: ${key}`);
  return value;
}

function instructions(key, audioAsset) {
  const { MarketGachaService } = require("../dist/service/market/marketGachaService.js");
  return MarketGachaService.getTicketInstructions(prize(key), audioAsset);
}

test("market gacha prize probabilities total 100 percent", () => {
  assert.equal(MARKET_GACHA_PRIZES.reduce((sum, item) => sum + item.probability, 0), 100);
});

test("market gacha uses the updated prize probabilities", () => {
  assert.deepEqual(
    Object.fromEntries(MARKET_GACHA_PRIZES.map((item) => [item.key, item.probability])),
    {
      superchat: 18,
      song_cover: 18,
      idol_collab: 3,
      superchat_nomination: 5,
      game_free_1: 12.5,
      game_free_3: 7.5,
      secret_free_1: 6.5,
      secret_free_3: 4,
      freedom_free_1: 4,
      discount_5: 5,
      discount_10: 2,
      detention_pass_3_days: 7,
      custom_role_week: 0.5,
      one_more_chance: 5,
      day_off: 2,
    },
  );
});

test("market gacha selects updated prizes at probability boundaries", () => {
  assert.equal(selectMarketGachaPrize(0).key, "superchat");
  assert.equal(selectMarketGachaPrize(0.179999).key, "superchat");
  assert.equal(selectMarketGachaPrize(0.18).key, "song_cover");
  assert.equal(selectMarketGachaPrize(0.36).key, "idol_collab");
  assert.equal(selectMarketGachaPrize(0.564999).key, "game_free_1");
  assert.equal(selectMarketGachaPrize(0.565001).key, "game_free_3");
  assert.equal(selectMarketGachaPrize(0.639999).key, "game_free_3");
  assert.equal(selectMarketGachaPrize(0.64).key, "secret_free_1");
  assert.equal(selectMarketGachaPrize(0.704999).key, "secret_free_1");
  assert.equal(selectMarketGachaPrize(0.705).key, "secret_free_3");
  assert.equal(selectMarketGachaPrize(0.744999).key, "secret_free_3");
  assert.equal(selectMarketGachaPrize(0.745).key, "freedom_free_1");
  assert.equal(selectMarketGachaPrize(0.784999).key, "freedom_free_1");
  assert.equal(selectMarketGachaPrize(0.785).key, "discount_5");
  assert.equal(selectMarketGachaPrize(0.979999).key, "one_more_chance");
  assert.equal(selectMarketGachaPrize(0.98).key, "day_off");
  assert.equal(selectMarketGachaPrize(0.999999).key, "day_off");
});

test("market gacha rejects invalid random values", () => {
  for (const value of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => selectMarketGachaPrize(value));
  }
});

test("market gacha charge and daily limit remain unchanged", () => {
  assert.equal(MARKET_GACHA_PRICE, 5000);
  assert.equal(MARKET_GACHA_DAILY_LIMIT, 5);
});

for (const roleIds of [[], [ROLE_IDS.GIJUTU_LEADER], [ROLE_IDS.SABANUSI]]) {
  for (const paymentSource of ["currency", "invite_point"]) {
    test(`market gacha rejects a sixth draw before charging: roles=${roleIds}, payment=${paymentSource}`, async (t) => {
      const queries = [];
      const connection = {
        beginTransaction: t.mock.fn(async () => {}),
        execute: async (sql) => {
          queries.push(sql);
          if (sql.startsWith("SELECT user_id FROM accounts")) return [[{ user_id: "drawer" }]];
          if (sql.includes("FROM market_gacha_draws")) {
            return [Array.from({ length: 5 }, (_, id) => ({ id }))];
          }
          throw new Error(`Unexpected query after daily limit: ${sql}`);
        },
        commit: t.mock.fn(async () => {}),
        rollback: t.mock.fn(async () => {}),
        release: t.mock.fn(),
      };
      t.mock.method(DbService, "getConnection", async () => connection);
      t.mock.method(GachaCoinActivationService, "lockDrawGate", async () => {});
      const member = memberWithRoles(roleIds);
      await assert.rejects(MarketGachaService.draw({
        user: { id: "drawer" },
        member,
        guild: { members: { fetch: async () => member } },
      }, paymentSource), /市場ガチャは1日5回までです。/);
      assert.equal(queries.length, 2);
      assert.equal(connection.commit.mock.callCount(), 0);
      assert.equal(connection.rollback.mock.callCount(), 1);
      assert.equal(connection.release.mock.callCount(), 1);
    });
  }
}

test("market gacha payment selector offers LIA and invite points", () => {
  const buttonIds = createMarketGachaPaymentSelectionRow().toJSON().components
    .map((button) => button.custom_id);
  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_CURRENCY));
  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_INVITE_POINT));
});

test("market gacha confirmation button keeps the selected payment source", () => {
  const currencyIds = createMarketGachaConfirmationRow("currency").toJSON().components
    .map((button) => button.custom_id);
  const invitePointIds = createMarketGachaConfirmationRow("invite_point").toJSON().components
    .map((button) => button.custom_id);
  assert.ok(currencyIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_CONFIRM_CURRENCY));
  assert.ok(invitePointIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_CONFIRM_INVITE_POINT));
});

test("audio prizes select their files from matching database categories", () => {
  assert.equal(prize("superchat").audioCategory, "superchat");
  assert.equal(prize("song_cover").audioCategory, "song_cover");
});

test("audio prize output mentions the recording performer", () => {
  const output = instructions("superchat", {
    performerName: "強がり",
    performerUserId: "1223107953444257812",
    publicUrl: "https://example.com/file",
  });
  assert.match(output, /<@1223107953444257812>のサプボです！/);
  assert.match(output, /ファイルのURLをDMにて送信/);
  assert.match(output, /転載・転送・保存・画面録画等は禁止/);
});

test("Scarlet's song cover mentions Scarlet's Discord user ID", () => {
  const output = instructions("song_cover", {
    performerName: "secret",
    performerUserId: "1086598017345388685",
    publicUrl: "https://example.com/file",
  });
  assert.match(output, /<@1086598017345388685>の歌みたです！/);
});

test("manual prizes guide users to the market ticket flow", () => {
  assert.equal(prize("detention_pass_3_days").label, "どこでも通行券");
  for (const key of ["detention_pass_3_days", "custom_role_week"]) {
    const output = instructions(key);
    assert.match(output, new RegExp(`<#${TEXT_CHANNEL_IDS.GENERAL_INQUIRY}>`));
    assert.match(output, /市場チケット/);
    assert.match(output, /スクショしてチケット内に送信/);
  }
  assert.match(instructions("custom_role_week"), /1週間限定のカスタムロール/);
});

test("collaboration prizes mention their intended roles", () => {
  assert.match(instructions("idol_collab"), new RegExp(`<@&${ROLE_IDS.SINGER_CROWN}>`));
  const nomination = instructions("superchat_nomination");
  assert.match(nomination, new RegExp(`<@&${ROLE_IDS.CORE_MEMBER_ROLES.HONMEN}>`));
  assert.match(nomination, new RegExp(`<@&${ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN}>`));
  assert.match(nomination, /市場ガチャに追加/);
});

test("one more chance and day off have their intended result copy", () => {
  assert.match(instructions("one_more_chance"), /招待ポイントが1pt付与/);
  assert.match(instructions("day_off"), /また明日ガチャを引いてね/);
});

test("game ticket prizes explain 24-hour priority consumption", () => {
  assert.equal(prize("game_free_1").label, "遊戯チケット 1枚");
  assert.equal(prize("game_free_3").label, "遊戯チケット 3枚");
  assert.match(instructions("game_free_1"), /遊戯24h/);
  assert.match(instructions("game_free_1"), /優先的にチケットが消費/);
});

test("hotel and shop ticket prizes retain their guidance", () => {
  assert.match(instructions("secret_free_1"), /次回シークレットを使用時に、優先的にチケットが消費/);
  assert.match(instructions("freedom_free_1"), /次回フリーダムを使用時に、優先的にチケットが消費/);
  const discount = instructions("discount_5");
  assert.match(discount, /割引後の支払額を確認/);
  assert.match(discount, /100万LIA以上の商品には利用できません/);
});

test("market gacha log records the drawer, prize, and payment", () => {
  const log = formatMarketGachaDrawLog("123", prize("idol_collab"), "invite_point");
  assert.equal(THREAD_IDS.MARKET_GACHA_LOG_THREAD, "1536708822725427301");
  assert.match(log, /<@123>/);
  assert.match(log, /アイドルコラボ/);
  assert.match(log, /招待ポイント1pt/);
});
