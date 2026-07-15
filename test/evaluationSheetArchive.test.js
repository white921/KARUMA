const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canManageEvaluationSheetArchive,
  isDiscordUserId,
} = require("../dist/util/evaluationSheetPermission.js");
const {
  EvaluationSheetArchiveService,
} = require("../dist/service/evaluationSheetArchiveService.js");
const { ROLE_IDS } = require("../dist/constant/id.js");

function memberWithRoles(roleIds) {
  return { roles: { cache: { has: (roleId) => roleIds.includes(roleId) } } };
}

test("評価シート保存・削除権限は指定された4ロールに限定する", () => {
  for (const roleId of [
    ROLE_IDS.GIJUTU_LEADER,
    ROLE_IDS.SABANUSI,
    ROLE_IDS.EVALUATION_LEADER,
    ROLE_IDS.KANRISYA,
  ]) {
    assert.equal(canManageEvaluationSheetArchive(memberWithRoles([roleId])), true);
  }
  assert.equal(canManageEvaluationSheetArchive(memberWithRoles([])), false);
  assert.equal(
    canManageEvaluationSheetArchive(memberWithRoles([ROLE_IDS.EVALUATION_1KYUU])),
    false,
  );
});

test("保存削除コマンド用のDiscordユーザーIDを検証する", () => {
  assert.equal(isDiscordUserId("12345678901234567"), true);
  assert.equal(isDiscordUserId("12345678901234567890"), true);
  assert.equal(isDiscordUserId("12345"), false);
  assert.equal(isDiscordUserId("12345678901234567x"), false);
});

test("HTML transcriptは本文をエスケープし、添付URLを記録する", () => {
  const message = {
    author: {
      username: "evaluator",
      globalName: "評価員グローバル名",
      displayAvatarURL: () => "https://cdn.example.test/avatar.png",
    },
    member: { displayName: "評価員表示名" },
    createdTimestamp: Date.UTC(2026, 6, 15),
    content: "<script>alert('xss')</script>",
    embeds: [],
    attachments: new Map([
      ["1", { name: "memo.txt", url: "https://example.test/file?x=1&y=2" }],
    ]),
  };
  const html = EvaluationSheetArchiveService.createTranscriptHtml(
    "12345678901234567",
    "テスト評価",
    [message],
  );

  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /x=1&amp;y=2/);
  assert.match(html, /memo\.txt/);
  assert.match(html, /評価員表示名/);
  assert.match(html, /@evaluator/);
  assert.match(html, /cdn\.example\.test\/avatar\.png/);
});
