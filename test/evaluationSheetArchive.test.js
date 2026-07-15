const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  canManageEvaluationSheetArchive,
  isDiscordUserId,
} = require("../dist/util/evaluationSheetPermission.js");
const {
  EvaluationSheetArchiveService,
} = require("../dist/service/evaluationSheetArchiveService.js");
const {
  EvaluationSheetArchiveStorageService,
} = require("../dist/service/evaluationSheetArchiveStorageService.js");
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

test("現在の評価スレッドはユーザーIDとフォーラムIDで一意に管理する", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../src/sql/20260715_evaluation_sheet_current_threads.sql"),
    "utf8",
  );
  assert.match(migration, /PRIMARY KEY \(user_id, forum_id\)/);
  assert.match(migration, /ON DUPLICATE KEY UPDATE/);
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
      ["2", { name: "past-evaluation-12345678901234567-42.html", url: "https://example.test/old" }],
    ]),
  };
  const html = EvaluationSheetArchiveService.createTranscriptHtml(
    "12345678901234567",
    "テスト評価",
    [message],
    new Map([[42, "https://evaluations.example.test/evaluation-sheets/42.html"]]),
  );

  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /x=1&amp;y=2/);
  assert.match(html, /memo\.txt/);
  assert.match(html, /評価員表示名/);
  assert.match(html, /@evaluator/);
  assert.match(html, /cdn\.example\.test\/avatar\.png/);
  assert.match(html, /https:\/\/evaluations\.example\.test\/evaluation-sheets\/42\.html/);
  assert.match(html, /過去評価を開く/);
  assert.doesNotMatch(html, /https:\/\/example\.test\/old/);
});

test("復元用HTMLのファイル名はアーカイブごとに一意", () => {
  assert.equal(
    EvaluationSheetArchiveService.createArchiveFileName("12345678901234567", 1),
    "past-evaluation-12345678901234567-1.html",
  );
  assert.notEqual(
    EvaluationSheetArchiveService.createArchiveFileName("12345678901234567", 1),
    EvaluationSheetArchiveService.createArchiveFileName("12345678901234567", 2),
  );
});

test("評価HTMLの公開URLはR2の固定パスを使う", () => {
  const original = {
    endpoint: process.env.EVALUATION_ARCHIVE_R2_ENDPOINT,
    accessKeyId: process.env.EVALUATION_ARCHIVE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.EVALUATION_ARCHIVE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.EVALUATION_ARCHIVE_R2_BUCKET,
    publicBaseUrl: process.env.EVALUATION_ARCHIVE_PUBLIC_BASE_URL,
  };
  process.env.EVALUATION_ARCHIVE_R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
  process.env.EVALUATION_ARCHIVE_R2_ACCESS_KEY_ID = "test-key";
  process.env.EVALUATION_ARCHIVE_R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.EVALUATION_ARCHIVE_R2_BUCKET = "evaluation-archives";
  process.env.EVALUATION_ARCHIVE_PUBLIC_BASE_URL = "https://evaluations.example.test/";

  assert.equal(
    EvaluationSheetArchiveStorageService.getPublicUrl(42),
    "https://evaluations.example.test/evaluation-sheets/42.html",
  );

  const restore = (key, value) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore("EVALUATION_ARCHIVE_R2_ENDPOINT", original.endpoint);
  restore("EVALUATION_ARCHIVE_R2_ACCESS_KEY_ID", original.accessKeyId);
  restore("EVALUATION_ARCHIVE_R2_SECRET_ACCESS_KEY", original.secretAccessKey);
  restore("EVALUATION_ARCHIVE_R2_BUCKET", original.bucket);
  restore("EVALUATION_ARCHIVE_PUBLIC_BASE_URL", original.publicBaseUrl);
});
