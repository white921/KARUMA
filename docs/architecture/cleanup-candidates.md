# 削除候補

2026-09-19時点のソースとテストを確認した候補。以下のファイルは今回削除していない。
`challengeMarkService.ts` は不要と確認されたため、削除とコメント内の参照除去を反映した。

## 実行経路のないファイル

| 候補 | 確認できた根拠 | 削除時に合わせて整理するもの |
| --- | --- | --- |
| [`monthlyDebitService.ts`](../../src/service/currency/monthlyDebitService.ts) | 全体がコメントアウトされ、スケジュールとimportも無効 | 未使用の [`constant/monthlyDebit.ts`](../../src/constant/monthlyDebit.ts)、`scheduleHandler.ts` の停止中ブロック、将来分離メモ |
| [`remindToMadoromiService.ts`](../../src/service/member/remindToMadoromiService.ts) | 全体がコメントアウトされ、有効な呼び出しがない | `roleHandler.ts`・`index.ts` の停止中の参照 |
| [`dailyMessageService.ts`](../../src/service/member/dailyMessageService.ts) | 有効なimport・定期実行がなく、テストでも日次告知をスケジュールしないことを確認している | このサービスだけが使用する [`constant/daily.ts`](../../src/constant/daily.ts)。面接シフト通知は別機能なので残す |
| [`constant/openAccount.ts`](../../src/constant/openAccount.ts) | `OPEN_ACCOUNT_MESSAGES` の参照がない | 現在の口座開設処理・管理者向け定数とは別ファイル |
| [`type/evaluation.ts`](../../src/type/evaluation.ts) | 旧評価DBの `Evaluation` 型に参照がない | 現行の評価シート・アーカイブの型は別ファイルなので残す |
| [`util/datetime.ts`](../../src/util/datetime.ts) | `showLogMessage` の呼び出し・importがない | 現行の日時処理は各機能からdayjsを直接利用している |

## 再開予定を確認してから削除する候補

[`command/inviteExtend.ts`](../../src/command/inviteExtend.ts)、
[`command/showEvaluation.ts`](../../src/command/showEvaluation.ts)、
[`command/showEvaluationEnd.ts`](../../src/command/showEvaluationEnd.ts) は、
`registerCommands.ts` の登録と `util/exeCommand.ts` の実行分岐がコメントアウトされている。
処理本体も停止中メッセージを返すだけだが、旧評価DBを再開したときに戻すTODOが残っている。
再開予定がなければ、ファイル・停止中の参照・対応するコマンド名定数をまとめて削除できる。

DBテーブルやSQLマイグレーションはこの削除候補に含めない。
