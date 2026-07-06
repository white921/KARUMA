# KARUMA Stability Observability Design

## Goal

Railway と Discord Gateway の不安定化が起きたときに、Bot 分割へ進む前に原因を追える状態を作る。最初の対象は「観測強化」「DB接続負荷の調整」「worker分離へ向けた起動制御」とする。

## Current Problem

インタラクションエラーがたまに発生し、再デプロイや再起動で一時的に回復する。現時点では、Discord Gateway 切断、ACK遅延、DB接続待ち、イベントループ詰まり、定期処理の競合のどれが主因か判断できない。

既存の `BotHealthMonitor` は ACK 成功/失敗と Gateway 状態を記録しているが、ACKまでの所要時間、watchdogの遅延、DB接続取得待ち、起動機能のON/OFFが不足している。

## Approach

まず Bot 数を増やさず、現在の常駐Botを軽くしながら観測できるようにする。

- `BotHealthMonitor` に pending interaction の文脈と ACK 所要時間を持たせる
- watchdog tick の遅延を記録し、イベントループ停止の兆候を残す
- `DbService` の MySQL pool を遅延初期化し、接続数を環境変数で調整できるようにする
- DB接続取得が遅い場合だけ警告ログを出す
- schedule と expired VC checker を環境変数で個別に停止できるようにする

## Runtime Controls

追加する環境変数:

- `MYSQL_CONNECTION_LIMIT`
  - MySQL pool の最大接続数
  - デフォルトは `5`
- `MYSQL_SLOW_ACQUIRE_LOG_MS`
  - DB接続取得待ちの警告しきい値
  - デフォルトは `1000`
- `ENABLE_SCHEDULES`
  - `false` で cron/schedule 系を起動しない
  - デフォルトは `true`
- `ENABLE_EXPIRED_VC_CHECKER`
  - `false` でホテルVC期限切れチェックを起動しない
  - デフォルトは `true`

## Future Worker Split

今回の変更で、将来 Railway 上に worker service を追加するときに以下のように分けられる。

- main Bot: Discord interaction と通常イベントを担当
- worker: schedule と期限切れVCチェックを担当

最初は worker を作らず、環境変数で機能単位の切り離しを可能にする。

## Testing

純粋関数を中心に `node:test` で検証する。

- runtime feature flag のデフォルトと `true`/`false`
- MySQL pool 設定の解決
- pending interaction の ACK 所要時間記録
- watchdog tick 遅延記録

最後に `npm test` を実行して、既存の build とテストが通ることを確認する。
