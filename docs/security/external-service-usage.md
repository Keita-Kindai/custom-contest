# External service usage policy and register

- Last reviewed: 2026-09-04
- Scope: Custom Contestが実行時または開発時にアクセスする外部サービス

## 実装前の手順

1. サービス名、行う操作、必要なデータ、目的、送信先、保存期間を先に書く。
2. 公式の利用規約、個別ルール、API文書、rate limit、privacy・著作権条件を読む。確認日とURLを残す。
3. 公開情報の技術調査と、特定ユーザーのデータ利用を分ける。後者は本人所有、User所有、またはUserが明示的に許可した対象だけを使う。
4. 最小限のfieldと頻度に絞り、cache、単一loop、同時実行防止、失敗時のbackoffまたは停止条件を決める。
5. 懸念点と不明点をUserへ示す。規約が曖昧、内部endpointを使う、または影響範囲が大きい場合は、Userの判断に加えてCodex / Claude Codeの別視点でも再確認する。
6. 実装後に実際の接続先と頻度をcodeから監査する。公開、多人数化、収益化、規約改定、endpoint変更時は再確認する。

第三者が同様のscriptを公開している事実は、技術的な先例ではあってもサービス提供者の許可ではありません。明示的な許可が見つからない場合は「禁止されていない」と「許可されている」を混同しません。

## 利用中のサービス

### AtCoder

目的は、参加者が過去問へ提出した結果を招待制BO1の勝敗へ反映することです。

- 実行主体: 各参加者が自分のAtCoder login sessionで動かすuserscript
- 使用データ: AtCoder ID、提出ID、contest・problem ID、提出時刻、判定、言語
- 使用しないデータ: source code本文、code長、email、password、session cookie
- Custom Contestへの送信: 対象Match・対象問題・制限時間内の提出だけ
- 保存: 対戦結果と必要最小限の提出履歴。未送信outboxはMatch終了後5分で破棄し、保存結果は90日後に削除する設計
- AtCoderへの通信: 待機中は判定先の到達確認を最大15秒に1回。active Match中は自分の提出一覧HTMLを最大5秒に1回。前のrequest中は次を開始しない。失敗時は最大60秒までbackoffし、`401`、`403`、`429`では直ちに60秒へ延ばす
- 実行tab: 接続専用の`https://atcoder.jp/` 1 tabだけ。問題tabを増やしてもpollは増えない
- server側: AtCoderへ直接アクセスしない

確認した公式規約では、1人1account、第三者へのaccount貸与・共有禁止、他者への著しい不利益、サービスへ損害を与える／そのおそれのある行為などが定められています。予備accountを同じ人が作ったり、友人へaccountを貸したりせず、各参加者が本人のaccountを使います。一方、使用中の提出一覧とstatus JSONは公開APIとして文書化されたendpointではなく、自動取得の数値上限も確認できませんでした。そのため、現在の2人LANデモは低頻度・本人データ・最小fieldに限定した「注意付き運用」とし、公式に許可済みとは表現しません。

本アプリは問題文や提出source codeを複製せず、問題名とAtCoderへのlinkだけを扱います。友人のAtCoder ID、提出時刻、判定、言語は対戦相手とホストserverへ共有されるため、参加前にその用途を伝えます。

比較対象のAtCoderResultNotifier 1.0.6は、提出一覧DOMからPending IDを集め、Pendingがある間はstatus JSONを5秒に1回確認し、確定時に提出詳細を1回取得します。Custom Contest 0.1.2-demoは最大頻度を5秒に1回以下へ揃えましたが、自動発見のためstatus JSONではなく提出一覧HTMLを取得する違いがあります。

過去問の練習には現在のABC・ARC・AGC向け生成AIルールは適用されません。ただし開催中の公式ABC・ARC・AGCでは生成AI利用が原則禁止されているため、本アプリの開発支援と公式コンテスト参加を混同せず、デモは過去問だけを使います。

Sources:

- AtCoder利用規約: https://atcoder.jp/tos?lang=ja
- AtCoder生成AI対策ルール: https://info.atcoder.jp/entry/llm-rules-ja
- AtCoderResultNotifier code 1.0.6: https://greasyfork.org/en/scripts/371225-atcoderresultnotifier/code

再確認条件:

- 知らない人との対戦、公開matchmaking、同時参加者増加
- leaderboard、rating、賞品、収益化
- server-side pollingまたは第三者アカウントの提出取得
- poll間隔短縮、対象tab拡大、新しいAtCoder endpoint利用
- AtCoder規約またはコンテストルールの改定

### AtCoder Problems

目的は、開発者がC/D・difficulty 400–1200の固定問題poolを生成することです。Room作成やMatch中にはアクセスせず、生成済みJSONを読みます。個人の提出情報は取得しません。

- 使用endpoint: `problems.json` と `problem-models.json`
- 頻度: 手動生成時に各1回、1.1秒空けて逐次取得
- 根拠: 公式repositoryのAPI文書は、アクセス間に1秒より長いsleepを求めています
- 注意: 非公式AtCoder情報APIであり、廃止・変更があり得ます。difficultyは非公式推定値として表示します

Source: https://github.com/kenkoooo/AtCoderProblems/blob/main/doc/api.md

### Greasy Fork / AtCoderResultNotifier

目的はuserscript設計の調査だけです。実行時依存やGreasy Fork API通信はありません。version 1.0.6の公開sourceを読み、考え方を参考にしました。公開ページ上のlicenseはMITですが、現在の実装は古いjQuery codeを複製せずTypeScriptで作り直しています。将来codeを複製・改変する場合は著作権表示とMIT Licenseの条件を同梱します。

Source: https://greasyfork.org/en/scripts/371225-atcoderresultnotifier

## 判断状態

- AtCoder 2人招待制デモ: 注意付きで継続。公式許可を確認した状態ではない
- AtCoderを使う公開・多人数版: 保留。上記の再確認と、必要ならAtCoderへの問い合わせを行う
- AtCoder Problems固定pool生成: 文書化された1秒超間隔へ適合
- 無関係な第三者の公開提出: 使用しない
