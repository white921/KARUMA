# ソースコードの配置

各層の下を機能ごとに分ける。同じ機能には `account`・`currency`・`hotel`・
`game`・`market`・`evaluation` など共通のフォルダー名を使い、全体共通の定義は
`shared`、実行基盤は `system` に置く。必要な層だけにフォルダーを作る。

| 層 | 役割 | 例 |
| --- | --- | --- |
| `command` | スラッシュコマンドの定義と入口 | `command/currency/send.ts` |
| `handler` | イベント・操作の振り分け、定期実行 | `handler/interaction/panelButtonHandler.ts` |
| `panel` | パネルの表示内容・ボタン構築・投稿・設置 | `panel/hotel/hotelPanelService.ts` |
| `service` | 購入、送金、VC管理などの機能処理 | `service/hotel/hotelVcService.ts` |
| `constant` | 料金、権限一覧、メッセージ、固定設定 | `constant/hotel/hotel.ts` |
| `type` | interface、名前付きtype、DB取得結果の型 | `type/hotel/hotel.ts` |
| `util` | 補助処理、入力・権限チェック | `util/shared/operatorPermission.ts` |
| `sql` | 新規DB定義と過去のマイグレーション | `sql/createTable.sql` |

`index.ts` はBotの入口、`registerCommands.ts` はコマンド登録の入口とする。
`handler` の操作処理は `interaction`、ロール変更は `member`、定期実行は `system` に置く。
複数機能にまたがるボタン・モーダル・選択メニューの補助は `util/interaction` に置く。

## パネルとサービス

常設パネルの描画・設置は [panel](panel/README.md) に置く。
操作後の購入・送金・VC作成や、その処理に必要な確認画面は各サービスが担当する。

## 定数と型

- 固定の料金表・権限一覧・メッセージ・タイムアウトは `constant/<機能>` に置く。
- `interface` と名前付き `type` は `type/<機能>` に置き、`import type` で参照する。
- Discord全体のIDと共通コマンド名は `constant/shared` に集約する。
- 関数内の計算結果、一時変数、接続プール、Map、監視状態は使用する処理内で管理する。
- importは対象ファイルを直接指定し、一括再export用の `index.ts` は追加しない。

## 移動・削除時の確認

1. 呼び出し元のimport、テストのソース参照・ビルド成果物参照、現行ドキュメントを更新する。
2. コマンドを削除するときは登録・実行分岐・コマンド名を一緒に確認する。
3. `npm test` でクリーンビルドと全 `test/*.test.js` を実行する。

`npm run build` は `dist` を作り直す。削除・移動前のJavaScriptが残って検証や運用に
混ざることを防ぐ。`sql` の適用済みマイグレーションは履歴として維持する。
