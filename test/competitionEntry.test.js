const test = require("node:test");
const assert = require("node:assert/strict");
const { ButtonStyle, MessageFlags } = require("discord.js");

const {
  COMPETITION_DISCIPLINES,
  COMPETITION_ENTRY_ACTIONS,
  COMPETITION_ENTRY_INPUT_IDS,
  COMPETITION_ENTRY_PANEL_CHANNEL_ID,
  COMPETITION_ENTRY_PANEL_TITLE,
  competitionEntryCustomId,
} = require("../dist/constant/member/competitionEntry.js");
const { TEAM_ASSIGNMENTS } = require("../dist/constant/member/teamAssignment.js");
const { ROLE_IDS, THREAD_IDS } = require("../dist/constant/shared/id.js");
const {
  createCompetitionEntryPanelPayload,
} = require("../dist/panel/member/competitionEntryPanelService.js");
const {
  CompetitionEntryService,
  createCompetitionEntriesCsv,
  parseCompetitionAvailability,
  parseScheduleAvailability,
} = require("../dist/service/member/competitionEntryService.js");
const {
  CompetitionEntryStore,
} = require("../dist/service/member/competitionEntryStore.js");
const { handlePanelButton } = require("../dist/handler/interaction/panelButtonHandler.js");
const { AccountService } = require("../dist/service/account/accountService.js");

function roleHolder(team, gender = "male") {
  const roleIds = new Set();
  if (team) roleIds.add(TEAM_ASSIGNMENTS[team].roleId);
  if (gender === "male" || gender === "both") roleIds.add(ROLE_IDS.BASIC_ROLE_IDS.OSU);
  if (gender === "female" || gender === "both") roleIds.add(ROLE_IDS.BASIC_ROLE_IDS.MESU);
  return {
    displayName: "回答者",
    roles: { cache: { has: (id) => roleIds.has(id) } },
  };
}

test("panel has the recommended title and exactly two entry buttons", () => {
  const payload = createCompetitionEntryPanelPayload();
  const embed = payload.embeds[0].toJSON();
  const buttons = payload.components[0].toJSON().components;
  assert.equal(COMPETITION_ENTRY_PANEL_TITLE, "第１回 LEVELIA双璧戦 競技エントリーシート");
  assert.equal(COMPETITION_ENTRY_PANEL_CHANNEL_ID, "1555266461604384898");
  assert.equal(COMPETITION_ENTRY_PANEL_CHANNEL_ID, THREAD_IDS.COMPETITION_ENTRY_PANEL);
  assert.deepEqual(buttons.map((button) => button.label), ["回答・編集", "回答確認"]);
  assert.deepEqual(buttons.map((button) => button.custom_id), [
    COMPETITION_ENTRY_ACTIONS.OPEN,
    COMPETITION_ENTRY_ACTIONS.REVIEW,
  ]);
  assert.deepEqual(buttons.map((button) => button.style), [
    ButtonStyle.Primary,
    ButtonStyle.Secondary,
  ]);
  assert.equal(payload.content, "");
  assert.doesNotMatch(
    embed.description,
    /各組|人数未定|出場確定|双璧戦で参加|後から何度でも/,
  );
  for (const discipline of Object.values(COMPETITION_DISCIPLINES)) {
    assert.match(embed.description, new RegExp(discipline.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("availability accepts common Japanese answers and rejects ambiguous text", () => {
  for (const value of ["出場できる", "出れる", "可", "○", "Ｏ"]) {
    assert.equal(parseCompetitionAvailability(value), "available");
  }
  for (const value of ["条件付き", "要相談", "△"]) {
    assert.equal(parseCompetitionAvailability(value), "conditional");
  }
  for (const value of ["出場できない", "出れない", "不可", "×"]) {
    assert.equal(parseCompetitionAvailability(value), "unavailable");
  }
  assert.throws(() => parseCompetitionAvailability("たぶん"), /いずれか/);
  assert.equal(parseScheduleAvailability("◯"), "available");
  assert.equal(parseScheduleAvailability("△"), "conditional");
  assert.equal(parseScheduleAvailability("✕"), "unavailable");
  assert.throws(() => parseScheduleAvailability("未定"), /◯.*△.*✕/);
});

test("schedule button is treated as a modal-opening button", () => {
  assert.equal(
    CompetitionEntryService.isModalOpeningButton(
      COMPETITION_ENTRY_ACTIONS.SCHEDULE_EDIT,
    ),
    true,
  );
});

test("editor lists schedule and all nine disciplines and marks saved answers", async (t) => {
  t.mock.method(CompetitionEntryStore, "findByUser", async () => [{
    userId: "user",
    displayName: "回答者",
    team: "red",
    discipline: "mahjong",
    availability: "available",
    rankName: "雀豪1",
    gameName: "雀士A",
    gameId: "123",
    notes: "",
  }]);
  t.mock.method(CompetitionEntryStore, "findProfileByUser", async () => ({
    userId: "user", displayName: "回答者", team: "red",
    day1Availability: "available", day2Availability: "conditional",
    day3Availability: "unavailable", overallNotes: "2日目は夜から",
  }));
  let reply;
  await CompetitionEntryService.showEditor({
    user: { id: "user" },
    guild: { members: { fetch: async () => roleHolder("red") } },
    editReply: async (body) => { reply = body; },
  });
  const buttons = reply.components.flatMap((row) => row.toJSON().components);
  assert.equal(buttons.length, 10);
  const schedule = buttons.find(
    (button) => button.custom_id === COMPETITION_ENTRY_ACTIONS.SCHEDULE_EDIT,
  );
  assert.equal(schedule.label, "✓ 日程・全体備考");
  assert.equal(schedule.style, ButtonStyle.Success);
  const mahjong = buttons.find((button) => button.custom_id.endsWith(":mahjong"));
  assert.equal(mahjong.label, "✓ 麻雀（雀魂）");
  assert.equal(mahjong.style, ButtonStyle.Success);
});

test("answering requires exactly one team role", async (t) => {
  t.mock.method(CompetitionEntryStore, "findByUser", async () => []);
  t.mock.method(CompetitionEntryStore, "findProfileByUser", async () => undefined);
  await assert.rejects(
    CompetitionEntryService.showEditor({
      user: { id: "user" },
      guild: { members: { fetch: async () => roleHolder(null) } },
      editReply: async () => {},
    }),
    /先に対抗戦の所属チーム/,
  );
});

test("schedule modal selects day 1 to 3 and saves overall notes", async (t) => {
  t.mock.method(CompetitionEntryStore, "findProfileByUser", async () => ({
    userId: "user", displayName: "回答者", team: "blue",
    day1Availability: "available", day2Availability: "conditional",
    day3Availability: "unavailable", overallNotes: "2日目は夜から",
  }));
  let modal;
  await CompetitionEntryService.showScheduleModal({
    user: { id: "user" },
    guild: { members: { fetch: async () => roleHolder("blue") } },
    showModal: async (value) => { modal = value.toJSON(); },
  });
  assert.equal(modal.title, "日程・全体備考の回答");
  const inputs = modal.components.map((component) =>
    component.component ?? component.components[0]
  );
  assert.deepEqual(inputs.map((input) => input.custom_id), [
    COMPETITION_ENTRY_INPUT_IDS.DAY1,
    COMPETITION_ENTRY_INPUT_IDS.DAY2,
    COMPETITION_ENTRY_INPUT_IDS.DAY3,
    COMPETITION_ENTRY_INPUT_IDS.OVERALL_NOTES,
  ]);
  assert.deepEqual(inputs.slice(0, 3).map((input) => input.type), [3, 3, 3]);
  assert.deepEqual(inputs.slice(0, 3).map((input) => input.placeholder), [
    "参加可否を選択", "参加可否を選択", "参加可否を選択",
  ]);
  assert.deepEqual(
    inputs.slice(0, 3).map((input) =>
      input.options.find((option) => option.default)?.value
    ),
    ["available", "conditional", "unavailable"],
  );
  assert.deepEqual(inputs[0].options.map((option) => option.label), [
    "◯ 参加可能", "△ 条件付き・要相談", "✕ 参加不可",
  ]);
  assert.match(inputs[3].placeholder, /2日目/);

  let saved;
  t.mock.method(CompetitionEntryStore, "upsertProfile", async (profile) => {
    saved = profile;
  });
  const values = new Map([
    [COMPETITION_ENTRY_INPUT_IDS.DAY1, "available"],
    [COMPETITION_ENTRY_INPUT_IDS.DAY2, "conditional"],
    [COMPETITION_ENTRY_INPUT_IDS.DAY3, "unavailable"],
    [COMPETITION_ENTRY_INPUT_IDS.OVERALL_NOTES, " 2日目は21時以降 "],
  ]);
  const replies = [];
  await CompetitionEntryService.submit({
    customId: COMPETITION_ENTRY_ACTIONS.SCHEDULE_MODAL,
    user: { id: "user" },
    guild: { members: { fetch: async () => roleHolder("blue") } },
    fields: {
      fields: { has: (id) => values.has(id) },
      getTextInputValue: (id) => values.get(id),
      getStringSelectValues: (id) => [values.get(id)],
    },
    deferReply: async (body) => replies.push(["defer", body]),
    editReply: async (body) => replies.push(["edit", body]),
  });
  assert.deepEqual(saved, {
    userId: "user",
    displayName: "回答者",
    team: "blue",
    day1Availability: "available",
    day2Availability: "conditional",
    day3Availability: "unavailable",
    overallNotes: "2日目は21時以降",
  });
  assert.match(replies[1][1].content, /1日目：\*\*◯\*\*/);
  assert.match(replies[1][1].content, /2日目：\*\*△\*\*/);
  assert.match(replies[1][1].content, /3日目：\*\*✕\*\*/);
});

test("mahjong modal uses Jantama rank, name and player ID fields", async (t) => {
  t.mock.method(CompetitionEntryStore, "findByUser", async () => [{
    userId: "user", displayName: "回答者", team: "blue", discipline: "mahjong",
    availability: "available", rankName: "雀傑2", gameName: "じゃんし", gameId: "9988", notes: "夜のみ",
  }]);
  let modal;
  await CompetitionEntryService.showDisciplineModal({
    customId: competitionEntryCustomId("edit", "mahjong"),
    user: { id: "user" },
    guild: { members: { fetch: async () => roleHolder("blue") } },
    showModal: async (value) => { modal = value.toJSON(); },
  });
  assert.equal(modal.title, "麻雀（雀魂）の回答");
  const inputs = modal.components.map((row) => row.components[0]);
  assert.deepEqual(inputs.map((input) => input.custom_id), [
    COMPETITION_ENTRY_INPUT_IDS.AVAILABILITY,
    COMPETITION_ENTRY_INPUT_IDS.RANK,
    COMPETITION_ENTRY_INPUT_IDS.GAME_NAME,
    COMPETITION_ENTRY_INPUT_IDS.GAME_ID,
    COMPETITION_ENTRY_INPUT_IDS.NOTES,
  ]);
  assert.equal(inputs[1].value, "雀傑2");
  assert.match(inputs[1].placeholder, /雀傑2/);
});

test("each discipline only asks for identifiers that the game actually uses", async (t) => {
  t.mock.method(CompetitionEntryStore, "findByUser", async () => []);
  t.mock.method(CompetitionEntryStore, "findProfileByUser", async () => undefined);
  const expected = {
    singing: ["availability", "notes"],
    unite: ["availability", "rank_name", "game_name", "game_id", "notes"],
    free: ["availability", "game_name", "game_id", "notes"],
    gf: ["availability", "rank_name", "game_name", "notes"],
    mahjong: ["availability", "rank_name", "game_name", "game_id", "notes"],
    fall_guys: ["availability", "rank_name", "game_name", "notes"],
    valorant: ["availability", "rank_name", "game_name", "notes"],
    lol: ["availability", "rank_name", "game_name", "notes"],
    minecraft: ["availability", "game_name", "notes"],
  };
  const expectedPlaceholders = {
    singing: [
      "出場できる / 条件付き / 出場できない",
      "例：得意な音域、参加可能な時間帯",
    ],
    unite: [
      "出場できる / 条件付き / 出場できない",
      "例：マスター（レート1400）",
      "例：UNITEで公開されている名前",
      "プロフィールに表示されるトレーナーID",
      "例：得意レーン、よく使うポケモン、参加可能時間",
    ],
    free: [
      "出場できる / 条件付き / 出場できない",
      "例：スマブラ、クイズ企画",
      "例：PlayerName#1234、フレンドコード",
      "例：希望ルール、必要人数、参加可能時間",
    ],
    gf: [
      "出場できる / 条件付き / 出場できない",
      "例：1500",
      "GFで使用する預言者の名前",
      "例：参加可能な時間帯",
    ],
    mahjong: [
      "出場できる / 条件付き / 出場できない",
      "例：雀傑2、雀豪1",
      "雀魂で表示される名前",
      "プロフィールに表示される数字のプレイヤーID",
      "例：四麻／三麻、参加可能な時間帯",
    ],
    fall_guys: [
      "出場できる / 条件付き / 出場できない",
      "例：Gold、Ace、Superstar",
      "PC・SwitchはEpic表示名、PS・Xboxは各ID",
      "例：PC、Switch、PlayStation、Xbox",
    ],
    valorant: [
      "出場できる / 条件付き / 出場できない",
      "例：ゴールド2、ダイヤモンド1",
      "例：PlayerName#JP1",
      "例：メインロール、使用エージェント、参加可能時間",
    ],
    lol: [
      "出場できる / 条件付き / 出場できない",
      "例：ゴールドIV、エメラルドII",
      "例：PlayerName#JP1",
      "例：TOP、JG、MID、ADC、SUP",
    ],
    minecraft: [
      "出場できる / 条件付き / 出場できない",
      "Javaはプロフィール名、統合版はゲーマータグ",
      "例：Java版、統合版、どちらも参加可能",
    ],
  };

  for (const [discipline, inputIds] of Object.entries(expected)) {
    let modal;
    await CompetitionEntryService.showDisciplineModal({
      customId: competitionEntryCustomId("edit", discipline),
      user: { id: "user" },
      guild: { members: { fetch: async () => roleHolder("red") } },
      showModal: async (value) => { modal = value.toJSON(); },
    });
    assert.deepEqual(
      modal.components.map((row) => row.components[0].custom_id),
      inputIds,
      discipline,
    );
    assert.deepEqual(
      modal.components.map((row) => row.components[0].placeholder),
      expectedPlaceholders[discipline],
      `${discipline} placeholders`,
    );
  }

  assert.equal(COMPETITION_DISCIPLINES.gf.gameNameLabel, "預言者の名前");
  assert.equal(COMPETITION_DISCIPLINES.fall_guys.gameIdLabel, null);
  assert.match(COMPETITION_DISCIPLINES.valorant.gameNameLabel, /#タグライン/);
  assert.equal(COMPETITION_DISCIPLINES.valorant.gameIdLabel, null);
  assert.equal(COMPETITION_DISCIPLINES.lol.gameIdLabel, null);
  assert.equal(COMPETITION_DISCIPLINES.minecraft.gameIdLabel, null);
});

test("singing modal omits category input and submission uses the gender role", async (t) => {
  t.mock.method(CompetitionEntryStore, "findByUser", async () => []);
  let modal;
  await CompetitionEntryService.showDisciplineModal({
    customId: competitionEntryCustomId("edit", "singing"),
    user: { id: "user" },
    guild: { members: { fetch: async () => roleHolder("red", "female") } },
    showModal: async (value) => { modal = value.toJSON(); },
  });
  assert.deepEqual(
    modal.components.map((row) => row.components[0].custom_id),
    [COMPETITION_ENTRY_INPUT_IDS.AVAILABILITY, COMPETITION_ENTRY_INPUT_IDS.NOTES],
  );

  let saved;
  t.mock.method(CompetitionEntryStore, "upsert", async (entry) => { saved = entry; });
  const values = new Map([
    [COMPETITION_ENTRY_INPUT_IDS.AVAILABILITY, " 出れる "],
    [COMPETITION_ENTRY_INPUT_IDS.NOTES, "高音"],
  ]);
  const replies = [];
  await CompetitionEntryService.submit({
    customId: competitionEntryCustomId("modal", "singing"),
    user: { id: "user" },
    guild: { members: { fetch: async () => roleHolder("red", "female") } },
    fields: {
      fields: { has: (id) => values.has(id) },
      getTextInputValue: (id) => values.get(id),
    },
    deferReply: async (body) => replies.push(["defer", body]),
    editReply: async (body) => replies.push(["edit", body]),
  });
  assert.equal(replies[0][1].flags, MessageFlags.Ephemeral);
  assert.deepEqual(saved, {
    userId: "user",
    displayName: "回答者",
    team: "red",
    discipline: "singing",
    availability: "available",
    rankName: "",
    gameName: "♀",
    gameId: "",
    notes: "高音",
  });
  assert.match(replies[1][1].content, /保存しました/);
});

test("singing rejects missing or duplicated gender roles", async (t) => {
  t.mock.method(CompetitionEntryStore, "findByUser", async () => []);
  for (const gender of [null, "both"]) {
    await assert.rejects(
      CompetitionEntryService.showDisciplineModal({
        customId: competitionEntryCustomId("edit", "singing"),
        user: { id: "user" },
        guild: { members: { fetch: async () => roleHolder("red", gender) } },
        showModal: async () => {},
      }),
      /ロール/,
    );
  }
});

test("competition buttons bypass the normal account requirement", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => {
    throw new Error("account check must not run");
  });
  t.mock.method(CompetitionEntryStore, "findByUser", async () => []);
  t.mock.method(CompetitionEntryStore, "findProfileByUser", async () => undefined);
  let reply;
  await handlePanelButton({
    customId: COMPETITION_ENTRY_ACTIONS.OPEN,
    user: { id: "user" },
    guild: { members: { fetch: async () => roleHolder("blue") } },
    editReply: async (body) => { reply = body; },
  });
  assert.equal(reply.components.flatMap((row) => row.toJSON().components).length, 10);
});

test("CSV includes schedule, overall notes and readable discipline labels", () => {
  const csv = createCompetitionEntriesCsv([{
    userId: "123",
    displayName: '名前,"改行\nあり',
    team: "blue",
    discipline: "mahjong",
    availability: "conditional",
    rankName: "雀豪1",
    gameName: "雀士",
    gameId: "999",
    notes: "夜のみ",
    updatedAt: "2026-10-02T00:00:00Z",
  }], [{
    userId: "123",
    displayName: "回答者",
    team: "blue",
    day1Availability: "available",
    day2Availability: "conditional",
    day3Availability: "unavailable",
    overallNotes: "2日目は夜から",
    updatedAt: "2026-10-02T00:00:00Z",
  }]).toString("utf8");
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /"蒼組"/);
  assert.match(csv, /"麻雀（雀魂）"/);
  assert.match(csv, /"条件付き・要相談"/);
  assert.match(csv, /"名前,""改行 あり"/);
  assert.match(csv, /"1日目","2日目","3日目","全体備考"/);
  assert.match(csv, /"◯","△","✕","2日目は夜から"/);
});

test("leader export only returns the leader's own team", async (t) => {
  let requestedTeam;
  t.mock.method(CompetitionEntryStore, "findByTeam", async (team) => {
    requestedTeam = team;
    return [];
  });
  t.mock.method(CompetitionEntryStore, "findProfilesByTeam", async () => []);
  let reply;
  await CompetitionEntryService.exportForLeader({
    user: { id: TEAM_ASSIGNMENTS.blue.captainUserId },
    guild: {},
    editReply: async (body) => { reply = body; },
  });
  assert.equal(requestedTeam, "blue");
  assert.match(reply.content, /蒼組/);
  assert.equal(reply.files[0].name, "双璧戦_競技回答_蒼組.csv");

  await assert.rejects(
    CompetitionEntryService.exportForLeader({
      user: { id: "not-a-leader" },
      guild: {},
      editReply: async () => {},
    }),
    /大将または副大将/,
  );
});
