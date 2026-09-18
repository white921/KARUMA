# Future Separation Notes

現在のサービス配置は [サービスの配置](../../src/service/README.md) を参照してください。
以下は将来Botプロセスを分離する場合の検討メモであり、現在のフォルダー境界とは異なります。

## Domain Buckets

### vc-domain

- `src/service/vc/vcService.ts`
- `src/panel/vc/vcPanelService.ts`
- `src/service/hotel/hotelVcService.ts`
- `src/panel/hotel/hotelPanelService.ts`
- `src/service/vc/teleportVcService.ts`
- 関連する `handler`, `command`, `constant/vc/vc.ts`, `constant/hotel/hotel.ts`, `constant/vc/teleport.ts`

このまとまりは「VC 作成、VC 名変更、VC 移動、ホテル系 VC 管理」が責務です。

### currency-domain

- `src/service/account/accountService.ts`
- `src/service/account/openAccountService.ts`
- `src/service/account/adminOpenAccountService.ts`
- `src/service/account/changeNameService.ts`
- `src/service/currency/sendService.ts`
- `src/service/currency/salaryService.ts`
- `src/service/currency/historyService.ts`
- `src/service/currency/adminMintService.ts`
- `src/service/currency/adminBurnService.ts`
- 関連する `command`, `type/account/account.ts`, `constant/account/account.ts`, `constant/currency/currency.ts`, `constant/currency/salary.ts`

このまとまりは「口座、残高、送金、付与、減額、履歴」が責務です。

### shared-domain

- `src/service/system/dbService.ts`
- `src/util/member/role.ts`
- `src/util/shared/channelMessage.ts`
- `src/constant/shared/id.ts`
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
