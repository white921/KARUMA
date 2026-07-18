# 日記機能の再有効化

## 目的

日記の作成・VIP化は維持したまま、停止中の通常日記の投稿監視と無投稿時の自動クローズを復活させる。

## 対象範囲

- `messageCreate` イベントで、日記フォーラム内の通常日記を監視する。
- 作成者本人と紐づくサブアカウント以外の投稿を削除する。
- 毎日0:10（Asia/Tokyo）に、3日間本人または紐づくサブアカウントから投稿がない日記をロック・アーカイブする。
- Message Content Intent を再び要求する。

## 対象外

- 日記の価格、無料対象、サブアカウント作成禁止、パネルの文言は変更しない。
- 日記フォーラム・パネル・ログの新しいID設定は維持する。
- VIP日記の投稿制限は追加しない。

## 実装

`src/index.ts` で日記フォーラム（本番・テスト）のスレッドに限定して `DiaryService.handleDiaryMessage` を呼ぶ。例外はログに残し、通常のBot処理を止めない。

`src/handler/scheduleHandler.ts` で `DiaryService.closeInactiveDiaries(client)` を毎日0:10に実行する。既存の `DiaryService` が、対象スレッドのロック・アーカイブとDBの `is_active` 更新を担当する。

## 検証

- 投稿監視と日次スケジュールが有効なことを静的テストで確認する。
- TypeScriptビルドと全テストを実行する。
