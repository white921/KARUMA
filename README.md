# KARUMA Bot

`Aether` Bot をベースに移植した `KARUMA` 用 Discord Bot です。初期状態では機能をほぼそのまま持ってきており、Discord 固有 ID は今後 `KARUMA` 用の値へ差し替える前提です。

## セットアップ

```bash
npm ci
cp .env.example .env
```

`.env` を埋めたあと、必要に応じてコマンド登録とビルドを行います。

```bash
npm run build
npm run register
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

`RAILWAY_DEPLOYMENT_ID` は Railway の組み込み環境変数をそのまま利用します。

## Discord ID の差し替え箇所

現時点では `Aether` の ID がそのまま入っています。`KARUMA` 用に差し替える主な場所は次です。

- `src/constant/id.ts`
- 必要に応じて `src/constant/*.ts` のチャンネル名や文言

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
