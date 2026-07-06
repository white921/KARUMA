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
- `BOT_HEALTH_CHECK_INTERVAL_MS`
  - Bot健全性監視の実行間隔
  - デフォルトは `60000` ミリ秒
- `BOT_HEALTH_ACK_TIMEOUT_MS`
  - interaction受信後にACK完了を待つ最大時間
  - デフォルトは `30000` ミリ秒
- `BOT_HEALTH_GATEWAY_DISCONNECT_TIMEOUT_MS`
  - gateway切断後に自己再起動するまでの猶予
  - デフォルトは `300000` ミリ秒
- `BOT_HEALTH_MAX_CONSECUTIVE_ACK_FAILURES`
  - 連続ACK失敗で自己再起動するしきい値
  - デフォルトは `3`

`RAILWAY_DEPLOYMENT_ID` は Railway の組み込み環境変数をそのまま利用します。

## Discord ID の差し替え箇所

現時点では `Aether` の ID がそのまま入っています。`KARUMA` 用に差し替える主な場所は次です。

- `src/constant/id.ts`
- 必要に応じて `src/constant/*.ts` のチャンネル名や文言

## パネル設置

- `/panel` を実行したチャンネルに応じて、対応するパネルを1つ設置します
- パネル未割当のチャンネルで実行するとエラーになります
- `1521078093715079199` のロールを持つメンバーのみ実行できます
- Discord の通常のスラッシュコマンド権限制御では、この実装だけで特定ロールに候補表示を完全制限することはしていません

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
