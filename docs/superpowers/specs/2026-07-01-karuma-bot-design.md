# KARUMA Bot Initial Migration Design

## Goal

`Aether` の Discord Bot を `KARUMA` にほぼそのまま移植し、独立した Git リポジトリとして今後の運用と拡張ができる初期状態を作る。

## Scope

- `Aether` の実装を `KARUMA` に複製する
- `KARUMA` 側で独立した Git 管理を成立させる
- プロジェクト名、README、環境変数サンプル、デプロイ前提を `KARUMA` 向けに更新する
- 将来の分離対象として VC 系機能と通貨系機能の境界を整理する

## Non-Goals

- Discord 固有 ID の置換
- 機能のリファクタリングや分割実装
- API サーバーの新規構築
- Railway 本番環境への実際の接続や認証済み設定変更

## Architecture

初回は `Aether` のコード構成を崩さずに `KARUMA` へコピーする。これにより既存機能との差分を最小化し、後続の ID 置換や動作確認を安全に進める。

設定値の注入点は現状どおり `.env` と `src/constant/id.ts` を中心に扱う。Discord 固有 ID はコード定数のまま維持し、後続で `KARUMA` 用値へ差し替える。

## Deployment

Railway 常駐運用を前提にし、`railway.toml` を維持する。必要な環境変数とデプロイ手順を README と `.env.example` に明記する。

## Future Separation View

- VC Bot 候補:
  `vcService.ts`, `vcPanelService.ts`, `hotelVcService.ts`, `hotelPanelService.ts`, `teleportVcService.ts`, `changeNameService.ts` と関連 handler/constant
- 通貨 Bot 候補:
  `accountService.ts`, `sendService.ts`, `salaryService.ts`, `historyService.ts`, `monthlyDebitService.ts`, `adminMintService.ts`, `adminBurnService.ts`, `openAccountService.ts` と関連 command/constant
- 共有候補:
  MySQL スキーマ、ユーザー照合、共通ロール判定、監査ログ送信

分離時は「1 つの DB を共有する複数 Bot」か「共通 API + 薄い Discord Bot 群」の 2 方向が現実的である。初期段階では前者のほうが移行コストが低く、機能再利用もしやすい。
