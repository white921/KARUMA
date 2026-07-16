# KARUMA Bot

`Aether` Bot をベースに移植した `KARUMA` 用 Discord Bot です。初期状態では機能をほぼそのまま持ってきており、Discord 固有 ID は今後 `KARUMA` 用の値へ差し替える前提です。

パネル設置は Bot 起動時の自動投稿ではなく、対応チャンネルで `/panel` を実行する運用です。

## セットアップ

```bash
npm ci
cp .env.example .env
```

`.env` を埋めたあと、必要に応じてコマンド登録とビルドを行います。

```bash
npm run build
npm run register
npm test
npm run start
```

## 必須環境変数

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `MYSQL_HOST`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_PORT`

## 任意環境変数

- `TECHNICIAN_IDS`
  - カンマ区切りの Discord ユーザー ID
- `RAILWAY_PROJECT_TOKEN`
  - Railway の定期再デプロイ機能を使う場合に必要
- `REGISTER_COMMANDS_ON_BOOT`
  - `true` のときだけ Bot 起動時にコマンド再登録を実行
  - 通常は `false` のままにして、必要時だけ `npm run register` を使う
- `EXPIRED_VC_CHECK_INTERVAL_MS`
  - ホテルVCの期限切れチェック間隔
  - デフォルトは `60000` ミリ秒
- `ENABLE_SCHEDULES`
  - `false` のとき Bot 起動時に cron/schedule 系の処理を開始しない
  - 将来 worker service へ定期処理を逃がすときに main Bot 側で `false` にする
- `ENABLE_EXPIRED_VC_CHECKER`
  - `false` のとき ホテルVC期限切れチェックを開始しない
  - 将来 worker service 側だけで期限切れチェックを動かすときに使う
- `MYSQL_CONNECTION_LIMIT`
  - MySQL connection pool の最大接続数
  - デフォルトは `5`
- `MYSQL_SLOW_ACQUIRE_LOG_MS`
  - DB接続取得待ちがこのミリ秒以上になったら警告ログを出す
  - デフォルトは `1000`
- `ROULETTE_EVENT_KEY`
  - ルーレットイベントを識別する値。2026年7月17日のイベントでは `2026-07-17`
- `ROULETTE_2ND_PANEL_CHANNEL_ID`
  - ヨーロピアンルーレット第2部パネルを置くTCのID
- `ROULETTE_3RD_PANEL_CHANNEL_ID`
  - ヨーロピアンルーレット第3部パネルを置くTCのID
- `BOT_HEALTH_CHECK_INTERVAL_MS`
  - Bot健全性監視の実行間隔
  - デフォルトは `15000` ミリ秒
- `BOT_HEALTH_ACK_TIMEOUT_MS`
  - interaction受信後にACK完了を待つ最大時間
  - デフォルトは `30000` ミリ秒
- `BOT_HEALTH_HANDLER_TIMEOUT_MS`
  - interaction のACK後、処理完了を待つ最大時間
  - デフォルトは `45000` ミリ秒
- `BOT_HEALTH_GATEWAY_DISCONNECT_TIMEOUT_MS`
  - gateway切断後に自己再起動するまでの猶予
  - デフォルトは `300000` ミリ秒
- `BOT_HEALTH_MAX_CONSECUTIVE_ACK_FAILURES`
  - 連続ACK失敗で自己再起動するしきい値
  - デフォルトは `3`
- `EVALUATION_ARCHIVE_R2_ENDPOINT`
  - 評価シートHTMLを保存するCloudflare R2のS3 APIエンドポイント
- `EVALUATION_ARCHIVE_R2_ACCESS_KEY_ID` / `EVALUATION_ARCHIVE_R2_SECRET_ACCESS_KEY`
  - 上記バケットに限定した「Object Read & Write」権限のR2 APIトークン
- `EVALUATION_ARCHIVE_R2_BUCKET`
  - 評価シートHTMLを保存するR2バケット名
- `EVALUATION_ARCHIVE_PUBLIC_BASE_URL`
  - 公開バケットのURL（末尾の`/`なし）。本番ではカスタムドメインを使用する

`RAILWAY_DEPLOYMENT_ID` は Railway の組み込み環境変数をそのまま利用します。

## 市場ガチャ

市場パネルで「市場ガチャを引く」を押すと、5,000krmまたは招待ポイント1ptを選択できます。支払い方法を選んだ後、確認ボタンを押すと抽選します。2種類の抽選を合計して日本時間で1日5回までです。

`/招待ポイント追加 ユーザー ポイント` でユーザーの招待ポイントを追加できます。実行できるのは技術統括・鯖主・管理者・ショップリーダー・ショップ従業員です。ポイントの付与・消費履歴はDBに保存されます。

- シークレット無料券・フリーダム無料券：当選時に自動付与され、ホテルパネルで12時間の該当ホテルを選ぶと「チケット」払いで消費できる
- ショップ割引券：当選時に自動付与され、ショップパネルの支払い時に使用するチケットを選ぶと消費される。利用者は割引適用後の支払い金額を入力し、Botは入力額をそのまま精算・記録する。割引券は100万krm未満の商品にのみ使用できる
- ショップ無料券・教祖遠隔：利用時は[総合お問い合わせ](https://discord.com/channels/1520329128883126392/1520368587255189545)で教団市場チケットを切り、当選メッセージを提示する
- サプボ・歌みた：R2の公開URLと演者名をDBから選び、当選者本人だけに見える「当選ファイルを開く」ボタンで渡す。Discordの添付容量上限を受けない
- 音源テーブルと配信履歴により、誰のどのファイルを渡したかを抽選ごとに記録する

既存DBに導入する場合は、デプロイ前に `src/sql/20260713_market_gacha.sql`、`src/sql/20260714_market_gacha_audio.sql`、`src/sql/20260718_shop_tickets.sql`、`src/sql/20260716_invite_points.sql` をこの順で適用してください。新規DBでは `src/sql/createTable.sql` に含まれています。適用後、技術統括が市場パネルのチャンネルで `/panel` を実行してパネルを更新してください。

## 評価シートの保存・削除・復元

`/2評価シート` で作成した2つの評価スレッドは、対象DiscordユーザーIDとともにDBへ記録されます。既存DBにはデプロイ前に `src/sql/20260715_evaluation_sheet_archives.sql` と `src/sql/20260715_evaluation_sheet_current_threads.sql` をこの順で適用してください（新規DBでは `src/sql/createTable.sql` に含まれます）。評価シートの保存・削除を使う前に、Cloudflare R2の公開バケットと以下のR2環境変数も設定してください。

評価本文を保存するため、Discord Developer Portal の Bot 設定で **Message Content Intent** も有効にしてください。コード側でも同Intentを要求しています。有効化せずに起動するとDiscordが接続を拒否します。

評価フォーラムではBotに「チャンネルを見る」「メッセージ履歴を読む」「スレッドの管理」「ファイルを添付」の権限も必要です。

- `/評価シート保存削除 user_id:<DiscordユーザーID> reason:<任意>`: 2スレッドの内容をHTMLとしてMySQLへ保存してから削除する。対象者が脱退済みでも実行できる
- `/評価シート復元 user:@ユーザー`: どのカテゴリでも実行できる。新しい評価スレッド2件を作成・DB登録し、それぞれに対応する直近の過去評価HTMLを添付する
- 保存・削除・復元を実行できるのは、技術統括・鯖主・評価員統括・管理者のみ

通常の `/2評価シート` で作成した場合も、過去評価があれば自動で添付されます。HTMLには投稿者のDiscordアイコン、サーバー表示名、ユーザー名、日時を記録します。

復元時は各フォーラムの直近アーカイブ1件を、固有ファイル名で添付します。全アーカイブは同時にCloudflare R2へHTMLファイルとして保存され、次回保存時に過去評価HTMLへの添付はR2の固定URLリンクへ置き換えられます。そのため、元スレッド削除後もHTML内の過去評価リンクは切れません。

R2は公開バケットとして設定します。評価内容をURLを知る人に見せてもよい運用であることを確認してください。CloudflareではR2バケットにカスタムドメインを接続して公開し、開発用の`r2.dev` URLは本番用途に使わないでください。

保存に失敗した場合はスレッドを削除しません。保存後に削除だけ失敗した場合も、再実行すれば再保存せず削除を再試行します。

現在の評価スレッドは `user_id + forum_id` を主キーとして管理します。同じユーザーが再度仮メンになった場合、作成された新しいスレッドIDでその行を更新します。過去のスレッドIDと評価本文はアーカイブとして保持されます。

## ヨーロピアンルーレット（2026-07-17）

ルーレット用テーブルを作成するため、デプロイ前に `src/sql/createTable.sql` を対象のMySQLへ適用してください。第1部パネルは `1525487297125155047` に固定しています。第2部・第3部のTCを作成後、対応する環境変数を設定してください。

各パネルTCで技術統括が `/panel` を実行すると、その部に対応したパネルを設置できます。参加者は「賭けを開始する」から賭け方と金額を選び、確認画面で確定します。一つのラウンドで確定できるベットは一人一件だけです。

- 第1部: 赤・黒・偶数・奇数（2倍）
- 第2部: 第1部にダズン `1-12` / `13-24` / `25-36`（3倍）を追加
- 第3部: 第2部にストレートアップ（36倍）と任意の二数字によるスプリット（18倍）を追加
- `0` の場合は全ベットが没収されます

運営コマンドを実行できるのは、イベント統括またはイベントスタッフのロール所持者だけです。以下の順で運用します。

1. `/賭け開始 fase:1st|2nd|3rd` で、開催する部を指定して受付を開始する。
2. 必要なら `/賭け終了` で明示的に締め切る。`/結果` は受付中でも自動的に締め切って精算する。
3. ディーラーが `/結果 number:0〜36` を実行する。結果と当選・配当は実行チャンネルへ投稿され、通貨残高と取引履歴が同時に更新される。
4. 次のラウンドは、前の結果を確定した後に再び `/賭け開始` を実行する。第1部・第2部を2回ずつ行う場合も同様です。
5. 終了時に `/ボーナス付与` を一度実行すると、そのイベントで一度でも確定ベットした参加者へ30,000通貨を配布する。二重配布はされません。

参加者が受付中ではない部の「賭けを開始する」ボタンを押した場合は、賭け方の選択画面を開かず、受付開始前である旨を本人だけに表示します。

## Discord ID の差し替え箇所

現時点では `Aether` の ID がそのまま入っています。`KARUMA` 用に差し替える主な場所は次です。

- `src/constant/id.ts`
- 必要に応じて `src/constant/*.ts` のチャンネル名や文言

## パネル設置

- `/panel` を実行したチャンネルに応じて、対応するパネルを1つ設置します
- パネル未割当のチャンネルで実行するとエラーになります
- `1521078093715079199` のロールを持つメンバーのみ実行できます
- Discord の通常のスラッシュコマンド権限制御では、この実装だけで特定ロールに候補表示を完全制限することはしていません

## おみくじ

`1526626039844049037` のTCで技術統括が `/panel` を実行すると、おみくじパネルを設置できます。口座を持つメンバーは無料で、日本時間の1日につき1回だけ引けます。

- 小吉: 1,000krm（35%）
- 中吉: 2,000krm（60%）
- 大吉: 5,000krm（5%）

既存DBへ導入する場合は、デプロイ前に `src/sql/20260715_daily_omikuji.sql` を適用してください。新規DBでは `src/sql/createTable.sql` に含まれています。

## Railway デプロイ

この Bot は `railway.toml` で Railway 常駐運用を想定しています。

- install: `npm ci`
- build: `npm run build`
- start: `npm run start`

### Railway の定期再デプロイ

Bot の `node-cron` から Railway API を叩いて、同じサービスを定期的に再デプロイできます。

- 4時間ごとに `01:30 / 05:30 / 09:30 / 13:30 / 17:30 / 21:30 JST` に自動で再デプロイ
- 既存の常駐 Bot が Railway Public API を直接呼び出す
- GitHub Actions は不要

### Railway 側で必要な設定

1. Service Variable に `RAILWAY_PROJECT_TOKEN` を追加

## よくある詰まりどころ

- `npm run register` は `CLIENT_ID`, `GUILD_ID`, `DISCORD_TOKEN` が未設定だと失敗します
- MySQL 接続情報が空だと起動後の各機能で `DB接続エラー` になります
- `KARUMA` 用の Discord ID に差し替えるまで、一部機能は正しく動きません
- 起動のたびにコマンド再登録したい場合だけ `REGISTER_COMMANDS_ON_BOOT=true` にしてください
