const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EvaluationSheetOperationLogService,
} = require("../dist/service/evaluation/evaluationSheetOperationLogService.js");

function fixture({ guildId = "guild", textBased = true, failSend = false } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      channels: {
        fetch: async (channelId) => {
          calls.push(["fetch", channelId]);
          return {
            guildId,
            isTextBased: () => textBased,
            send: async (payload) => {
              calls.push(["send", payload]);
              if (failSend) throw new Error("Discord unavailable");
            },
          };
        },
      },
    },
  };
}

test("削除と復元は指定チャンネルへ実行者・対象者・結果を記録する", async () => {
  const { client, calls } = fixture();

  await EvaluationSheetOperationLogService.sendDelete(client, "guild", {
    operatorUserId: "operator",
    targetUserId: "target",
    savedCount: 4,
    deletedCount: 4,
    pendingDeletionCount: 0,
    reason: "評価期間終了",
  });
  await EvaluationSheetOperationLogService.sendRestore(client, "guild", {
    operatorUserId: "operator",
    targetUserId: "target",
    createdCount: 4,
    restoredCount: 3,
    restoreFailureCount: 1,
  });

  assert.deepEqual(
    calls.filter(([kind]) => kind === "fetch").map(([, id]) => id),
    ["1553937485774594128", "1553937485774594128"],
  );
  const [deletion, restoration] = calls
    .filter(([kind]) => kind === "send")
    .map(([, payload]) => payload);
  assert.deepEqual(deletion.allowedMentions, { parse: [] });
  assert.deepEqual(restoration.allowedMentions, { parse: [] });
  assert.deepEqual(deletion.embeds[0].toJSON().fields, [
    { name: "実行者", value: "<@operator>" },
    { name: "対象者", value: "<@target>" },
    { name: "保存件数", value: "4件", inline: true },
    { name: "削除件数", value: "4件", inline: true },
    { name: "理由", value: "評価期間終了" },
  ]);
  assert.deepEqual(restoration.embeds[0].toJSON().fields, [
    { name: "実行者", value: "<@operator>" },
    { name: "対象者", value: "<@target>" },
    { name: "作成件数", value: "4件", inline: true },
    { name: "過去評価の添付", value: "3件", inline: true },
    { name: "添付失敗", value: "1件", inline: true },
  ]);
});

test("期間延長と短縮は専用チャンネルへ対象範囲・変更日数・結果を記録する", async () => {
  const { client, calls } = fixture();

  await EvaluationSheetOperationLogService.sendExtension(client, "guild", {
    operatorUserId: "operator",
    targetUserId: null,
    days: 3,
    extendedCount: 8,
    skippedCount: 2,
    failedCount: 1,
    reason: "面談日程の調整",
  });
  await EvaluationSheetOperationLogService.sendExtension(client, "guild", {
    operatorUserId: "operator",
    targetUserId: "target",
    days: -1,
    extendedCount: 4,
    skippedCount: 0,
    failedCount: 0,
    reason: null,
  });

  assert.deepEqual(
    calls.filter(([kind]) => kind === "fetch").map(([, id]) => id),
    ["1553937539491176559", "1553937539491176559"],
  );
  const [extension, shortening] = calls
    .filter(([kind]) => kind === "send")
    .map(([, payload]) => payload.embeds[0].toJSON());
  assert.equal(extension.title, "評価期間延長");
  assert.equal(shortening.title, "評価期間短縮");
  assert.deepEqual(extension.fields, [
    { name: "実行者", value: "<@operator>" },
    { name: "対象", value: "全員" },
    { name: "変更日数", value: "+3日", inline: true },
    { name: "更新件数", value: "8件", inline: true },
    { name: "スキップ", value: "2件", inline: true },
    { name: "失敗", value: "1件", inline: true },
    { name: "理由", value: "面談日程の調整" },
  ]);
  assert.equal(shortening.fields[1].value, "<@target>");
  assert.equal(shortening.fields[2].value, "-1日");
  assert.equal(shortening.fields[6].value, "未記入");
});

test("長い理由はDiscordのembed上限内に収める", async () => {
  const { client, calls } = fixture();
  await EvaluationSheetOperationLogService.sendExtension(client, "guild", {
    operatorUserId: "operator",
    targetUserId: null,
    days: 1,
    extendedCount: 4,
    skippedCount: 0,
    failedCount: 0,
    reason: "理".repeat(2000),
  });

  const payload = calls.find(([kind]) => kind === "send")[1];
  const reason = payload.embeds[0].toJSON().fields.at(-1).value;
  assert.equal(reason.length, 1024);
  assert.match(reason, /\.\.\.$/);
});

test("ログ送信失敗や別サーバーの送信先でも確定済み操作を失敗扱いにしない", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const options of [
    { failSend: true },
    { guildId: "other" },
    { textBased: false },
  ]) {
    const { client, calls } = fixture(options);
    await assert.doesNotReject(
      EvaluationSheetOperationLogService.sendRestore(client, "guild", {
        operatorUserId: "operator",
        targetUserId: "target",
        createdCount: 4,
        restoredCount: 4,
        restoreFailureCount: 0,
      }),
    );
    if (options.guildId === "other" || options.textBased === false) {
      assert.equal(calls.some(([kind]) => kind === "send"), false);
    }
  }
});
