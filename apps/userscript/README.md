# AtCoder userscript

提出結果の通知契約と脅威モデルをADRに従って実装しています。

userscriptから届く情報は `Submission evidence` として受け取り、サーバー検査後に対戦結果へ反映します。

## 調査済みの参考実装

[`AtCoderResultNotifier`](https://greasyfork.org/en/scripts/371225-atcoderresultnotifier) version 1.0.6はMIT Licenseです。このスクリプトは、AtCoderの提出一覧DOMから判定待ちの提出IDを集め、ログイン中のAtCoderブラウザーから同一オリジンの `/contests/{contest}/submissions/me/status/json` を5秒間隔で確認しています。

初回実装は考え方とセレクターの参考にとどめ、古いjQuery実装をそのまま複製せずTypeScriptで必要最小限のロジックを作り直します。コードを複製・改変する場合は、MIT Licenseの著作権表示と許諾表示を同梱します。

AtCoderの実データを使う検証は `Litms` またはユーザーが明示的に許可したアカウントと提出に限定し、提出コード本文は取得・送信・保存しません。

## 日曜デモ環境

- ChromeまたはEdge
- Tampermonkey
- AtCoderにログイン済みのブラウザープロファイル

インストール不要方式は採用せず、両参加者が専用userscriptをTampermonkeyへインストールします。

両参加者のuserscript接続が直近15秒以内に確認できない場合、RoomはREADYを許可しません。

heartbeatは5秒間隔でLAN内のCustom Contest serverへ送ります。これはAtCoderへの通信ではありません。AtCoderへの通信は、待機中の到達確認を最大15秒に1回、active Matchの提出一覧確認を5秒に1回の単一loopに限定します。提出一覧HTMLに含まれる判定を次のpollで読み直すため、同じ周期にstatus JSONを追加取得しません。前の取得が完了するまで次の取得は開始せず、Userscriptは接続専用の`https://atcoder.jp/`だけで動くため、問題・提出タブを追加してもpoll数は増えません。失敗時は10、20、40、最大60秒へ再試行間隔を延ばし、`401`、`403`、`429`では直ちに60秒へ延ばします。

参考実装と最大リクエスト頻度は同じ5秒に1回以下ですが、参考実装がPending中のstatus JSONを読むのに対し、本scriptは新規提出の自動検出に提出一覧HTMLを読みます。公式に公開されたAPIではないため、2人の招待制デモを超えて公開・多人数化する前に、`docs/security/external-service-usage.md`の再確認条件に従います。

userscript接続時にAtCoderへログイン中のIDを取得し、開発用プロフィールのAtCoder IDと一致することを確認します。不一致の場合はREADYを許可しません。同じRoomの2人が同一AtCoder IDを使うことも許可しません。AtCoder規約の1人1account・貸与禁止に従い、各参加者は本人のaccountを使い、デモ用の予備account作成や共有はしません。

## Roomとの接続

1. デモサーバーの接続先だけを許可したuserscriptをTampermonkeyへインストールする。
2. Room画面の「AtCoderと接続」から、一度だけ使える接続キーをURLのfragmentへ付けてAtCoderトップを開く。この接続専用タブは対戦中も開いておく。
3. userscriptが接続キーを読み取り、サーバーへ参加者との対応を登録する。
4. 対応付けを保存した直後に、接続キーをAtCoderのURLから消す。

初回接続と再接続成功の右下通知は4秒で自動的に消えます。再送中や接続障害中の通知は、復旧するまで表示します。

対戦中にheartbeatが15秒途切れてもMatchは停止しません。警告を表示し、userscriptは自動再接続と未送信通知の再送を行います。

接続キーは一回だけ使用でき、5分で期限切れになります。交換後のuserscript専用トークンはParticipantとRoomに限定し、退出・Room終了まで有効です。再接続時は古いトークンを無効にします。

READYの接続確認では、単にスクリプトが起動しているだけでなく、AtCoderへのログイン、プロフィールとのID一致、提出判定確認先へのアクセス成功を直近15秒以内に確認します。

## 判定待ち

最終判定だけでなく、制限時間内のPending submissionを発見したことは通知します。AtCoder側の細かな判定進捗は通知しません。これにより、時間切れ時に提出が判定中なら最大5分間待ち、全て非ACならDRAW、確認不能ならVOIDにできます。

通知する提出情報はAtCoder ID、提出ID、コンテストID、問題ID、提出時刻、最終判定、使用言語、実判定かFake判定かです。ソースコード本文とコード長は扱いません。

active Matchの対象問題と時間内提出だけを送信し、別問題の提出はCustom Contestへ送信しません。サーバー側も同じ条件を再検査します。

通知はサーバーのACKが返るまでTampermonkey内へ一時保存して再送し、Match終了後5分で破棄します。サーバーは同じ提出IDの同じ通知を一度だけ処理します。結果確定後の遅着通知は勝敗を変えませんが、有効な時間内提出なら履歴へ残します。

AtCoderから取得したAC、WA、TLE、MLE、RE、CE、OLE、IEなどの確定判定ラベルはそのまま送ります。AC以外は勝利条件になりません。

## Buildとインストール

デモサーバーのURLを埋め込んでbuildします。`@connect`もそのhostだけへ限定されます。

```sh
CUSTOM_CONTEST_SERVER_ORIGIN=http://192.168.1.10:3000 pnpm userscript:build
```

生成された `apps/userscript/dist/custom-contest-atcoder.user.js` をTampermonkeyへ読み込ませます。localhostだけで試す場合は環境変数を省略できます。
