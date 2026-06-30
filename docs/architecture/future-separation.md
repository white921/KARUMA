# Future Separation Notes

## Domain Buckets

### vc-domain

- `src/service/vcService.ts`
- `src/service/vcPanelService.ts`
- `src/service/hotelVcService.ts`
- `src/service/hotelPanelService.ts`
- `src/service/teleportVcService.ts`
- `src/service/changeNameService.ts`
- 関連する `handler`, `command`, `constant/vc.ts`, `constant/hotel.ts`, `constant/teleport.ts`

このまとまりは「VC 作成、VC 名変更、VC 移動、ホテル系 VC 管理」が責務です。

### currency-domain

- `src/service/accountService.ts`
- `src/service/openAccountService.ts`
- `src/service/adminOpenAccountService.ts`
- `src/service/sendService.ts`
- `src/service/salaryService.ts`
- `src/service/historyService.ts`
- `src/service/monthlyDebitService.ts`
- `src/service/adminMintService.ts`
- `src/service/adminBurnService.ts`
- 関連する `command`, `type/account.ts`, `constant/account.ts`, `constant/currency.ts`, `constant/salary.ts`

このまとまりは「口座、残高、送金、付与、減額、履歴、定期引き落とし」が責務です。

### shared-domain

- `src/service/dbService.ts`
- `src/util/role.ts`
- `src/util/channelMessage.ts`
- `src/constant/id.ts`
- 各種ログ送信、ユーザー照合、ロール判定

## Split Strategy

初期の分割は、1 つの MySQL を共有しながら Bot プロセスだけを分ける方式が最も現実的です。既存 SQL や運用フローを大きく崩さずに移行できます。

共通ロジックが増え、Bot ごとのデプロイ独立性や外部連携が必要になった段階で API 化を検討します。

## When An API Becomes Worthwhile

- 複数 Bot が同じ残高更新ロジックを安全に共有したい
- Discord 以外の管理画面やバッチから通貨機能を呼びたい
- 監査ログ、認可、レート制御を 1 箇所に寄せたい
- 将来的に Web UI や外部アプリ連携を増やしたい

この条件が揃うまでは、共通 DB + 共通ライブラリのほうがシンプルです。
