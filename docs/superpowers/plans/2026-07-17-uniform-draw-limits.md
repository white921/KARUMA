# 全員共通の抽選回数上限 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** おみくじと市場ガチャの日次上限を、技術統括・鯖主を含む全ユーザーへ適用する。

**Architecture:** ロールを使った免除判定を削除し、各サービスがトランザクション内で当日の抽選回数を無条件に検証する。上限判定を純粋な関数へ切り出し、DBやDiscordを使わないユニットテストで境界を固定する。

**Tech Stack:** TypeScript、discord.js、mysql2、Node.js built-in test runner

---

### Task 1: おみくじの免除を廃止する

**Files:**
- Modify: `test/omikuji.test.js:8-61`
- Modify: `src/service/omikujiService.ts:1-27,128-167,222-242`

- [ ] **Step 1: 日次上限の失敗テストを書く**

`test/omikuji.test.js` のサービス import を次にし、既存の `memberWithRoles` とロール免除テストを置き換える。

```js
const {
  assertOmikujiDailyLimit,
  assertOmikujiDrawAllowed,
  calculateOmikujiWalletAfter,
  createOmikujiSpecialLogEmbed,
  formatOmikujiDrawReply,
  getJapanDate,
} = require("../dist/service/omikujiService.js");

test("omikuji enforces the daily limit for every member", () => {
  assert.doesNotThrow(() => assertOmikujiDailyLimit(0));
  assert.throws(() => assertOmikujiDailyLimit(1), /日本時間で1日1回まで/);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run build && node --test test/omikuji.test.js`

Expected: FAIL because `assertOmikujiDailyLimit` is not exported.

- [ ] **Step 3: 最小実装を追加する**

`src/service/omikujiService.ts` から `GuildMember` と `ROLE_IDS` の import、`canBypassOmikujiDailyLimit`、`isDailyLimitExempt` を削除する。 `assertOmikujiDrawAllowed` の直後に追加する。

```ts
export function assertOmikujiDailyLimit(drawCount: number): void {
  if (drawCount > 0) {
    throw new Error("おみくじは日本時間で1日1回までです。次の0:00以降に引けます。");
  }
}
```

`draw` のDB照会は常に実行し、既存の `if (!isDailyLimitExempt)` ブロックを次に置き換える。

```ts
const [drawRows] = await connection.execute<RowDataPacket[]>(
  `SELECT id FROM omikuji_draws
   WHERE user_id = ? AND draw_date = ?
   LIMIT 1`,
  [interaction.user.id, drawDate],
);
assertOmikujiDailyLimit(drawRows.length);
```

クラスコメントを「全メンバーは日本時間で一日一回」に修正し、`interaction.editReply` の内容は `formatOmikujiDrawReply(prize, afterWallet, wasBalanceCapped)` のみとする。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run build && node --test test/omikuji.test.js`

Expected: PASS with the daily-limit boundary test included.

- [ ] **Step 5: コミットする**

```bash
git add src/service/omikujiService.ts test/omikuji.test.js
git commit -m "fix: enforce omikuji limit for all members"
```

### Task 2: 市場ガチャの免除を廃止する

**Files:**
- Modify: `test/marketGacha.test.js:10-62`
- Modify: `src/service/marketGachaService.ts:1-28,89-98,260-289,391-419`

- [ ] **Step 1: 日次上限の失敗テストを書く**

`test/marketGacha.test.js` から `ROLE_IDS`、`memberWithRoles`、`canBypassMarketGachaDailyLimit` を削除し、サービス import に `assertMarketGachaDailyLimit` を追加する。既存のロール免除テストを次に置き換える。

```js
test("market gacha enforces the five-draw daily limit for every member", () => {
  assert.doesNotThrow(() => assertMarketGachaDailyLimit(4));
  assert.throws(() => assertMarketGachaDailyLimit(5), /市場ガチャは1日5回まで/);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run build && node --test test/marketGacha.test.js`

Expected: FAIL because `assertMarketGachaDailyLimit` is not exported.

- [ ] **Step 3: 最小実装を追加する**

`src/service/marketGachaService.ts` から `GuildMember` と `ROLE_IDS` の import、`canBypassMarketGachaDailyLimit`、`isDailyLimitExempt` を削除する。ボタン生成関数の後に追加する。

```ts
export function assertMarketGachaDailyLimit(drawCount: number): void {
  if (drawCount >= MARKET_GACHA_DAILY_LIMIT) {
    throw new Error(`市場ガチャは1日${MARKET_GACHA_DAILY_LIMIT}回までです。`);
  }
}
```

`draw` から `isDailyLimitExempt` の取得を削除し、抽選履歴の照会直後を次にする。

```ts
assertMarketGachaDailyLimit(drawRows.length);
```

結果メッセージでは条件分岐を削除し、常に次を表示する。

```ts
`本日の残り回数：${remainingDraws}回\n\n`
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run build && node --test test/marketGacha.test.js`

Expected: PASS with the fifth-and-sixth draw boundary test included.

- [ ] **Step 5: コミットする**

```bash
git add src/service/marketGachaService.ts test/marketGacha.test.js
git commit -m "fix: enforce market gacha limit for all members"
```

### Task 3: 利用者向け仕様を同期し、回帰確認する

**Files:**
- Modify: `README.md:92,163-166`

- [ ] **Step 1: READMEを更新する**

市場ガチャの段落を「全メンバーが日本時間で1日5回まで」と明記する。おみくじの段落から技術統括・鯖主の免除説明を削除し、「全メンバーが日本時間で1日1回だけ引けます」とする。

- [ ] **Step 2: 全テストを実行する**

Run: `npm test`

Expected: PASS with TypeScript build and all listed Node tests succeeding.

- [ ] **Step 3: 変更を確認する**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the README update is unstaged after Tasks 1 and 2 commits.

- [ ] **Step 4: コミットする**

```bash
git add README.md
git commit -m "docs: clarify draw limits apply to all members"
```

