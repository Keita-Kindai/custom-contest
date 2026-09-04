# ADR-0004: userscriptからのSubmission evidence

- Status: Accepted
- Date: 2026-09-03
- Owners: User / Codex / Claude Code

## Context

AtCoderの実提出を日曜デモのMatchへ反映するには、Participantのブラウザーで動くuserscriptからCustom Contestへ判定を通知する必要がある。通知は通信切断、重複、遅着、別問題や別Participantの混入、userscript改造の影響を受け得る。

## Decision drivers

- 一時的な通信失敗でACを失わない
- 同じ提出を二重処理しない
- 別Room、別Match、別Participantの提出を勝敗へ混ぜない
- ソースコード本文など不要な情報を収集しない
- 日曜デモの範囲と、将来の公開対戦に必要な強度を混同しない

## Options

### Option A: userscript通知を検査して利用する

- 一回限りの接続キーを専用トークンへ交換し、userscriptが検知した提出情報を送る
- サーバーはParticipant、Match、問題、時刻、AtCoder ID、重複を検査する
- client側の改造を完全には防げないため、招待制のカジュアル対戦に限定する

### Option B: サーバーがAtCoder提出を独立して再取得する

- userscript通知をきっかけに、サーバーが別経路で提出を確認する
- client改造への耐性は上がるが、AtCoder側の公開境界、認証、アクセス制限、遅延へ依存する

### Option C: Fake提出だけを扱う

- 外部接続なしで対戦基盤を検証できる
- 日曜デモで実ACを反映する目標を満たさない

## Decision

Option Aを日曜デモと最初の招待制公開版へ採用する。Fake提出はLANデモ、開発、自動テストの復旧・検証手段としてだけ残し、公開版では無効にする。

## Consequences

- 接続キーは一回限りかつ5分で期限切れとし、userscript専用トークンへ交換する
- 専用トークンはParticipantとRoomへ限定し、退出・Room終了・再接続による更新時に無効化する
- AtCoder ID、提出ID、コンテストID、問題ID、提出時刻、最終判定、使用言語、実/Fakeの別を送信し、サーバー受信時刻を付ける
- ソースコード本文とコード長は取得、送信、保存しない
- userscriptはactive Matchの対象問題だけを送信し、サーバーも問題と提出時刻を再検査する
- ACKまでclient側で再送し、同じ提出IDの同じ通知を一度だけ処理する
- 結果確定後の有効な遅着通知は履歴へ残すが、勝敗を変更しない
- AtCoderの確定判定ラベルはそのまま履歴へ表示し、AC以外を勝利条件にはしない
- AtCoderへのrequestは待機中15秒に1回以下、active Match中5秒に1回以下の単一loopとし、同時実行や同一周期の追加status取得をしない
- 取得失敗時は最大60秒までbackoffし、認証拒否または`429`では直ちに60秒へ延ばす
- AtCoderの提出一覧は公式公開APIではないため、招待制2人デモを超える前に規約・運用許可・取得方式を再検討する
- 不正解による時間ペナルティは設けず、提出回数とミス回数だけを表示する
- 対戦中は相手の最新判定、提出回数、Pending submissionの有無を共有し、正確な時刻と言語は結果確定後に表示する
- 拒否された通知の具体的な理由は送信者だけへ表示し、相手には一般化した接続確認表示を出す
- 結果には「userscript確認・カジュアル対戦」と表示する
- READYには直近15秒以内のログイン、AtCoder ID一致、判定確認先アクセス成功を要求する
- client改造への完全な耐性は持たず、公開対戦、ランキング、レーティング導入前にOption B相当を再検討する
- Invite-onlyのカジュアル版を先に公開し、利用者の反応を受けて検証強度を上げる

## Verification

- 使用済みまたは発行から5分を過ぎた接続キーを拒否する
- 再接続後に古いuserscript専用トークンを拒否する
- ACK喪失による同一通知の再送でも、提出履歴と勝敗を一度だけ更新する
- Participant、AtCoder ID、Match、問題、提出時刻のいずれかが不一致なら勝敗へ反映しない
- active Matchと無関係な問題の提出がclientから送られず、直接送信されてもserverが拒否する
- ソースコード本文とコード長がAPI payload、log、databaseに存在しない
- 結果確定後の遅着ACが提出履歴へ追加されても勝者が変わらない
- AtCoderへのログイン、ID一致、判定先アクセスのいずれかが失敗したらREADYを許可しない
- 送信者には拒否理由が表示され、相手画面や結果に内部エラー情報が露出しない

## Revisit triggers

- 知らないParticipantとの公開対戦または自動マッチングを追加する
- Match結果をランキングまたはレーティングへ反映する
- AtCoderに公式なsubmission webhookまたは検証APIが提供される
- userscriptを不要にする提出取得方式を採用する
- AtCoderの規約、個別ルール、または内部endpointが変更される

## Evidence

- `docs/product/mvp.md`
- `apps/userscript/README.md`
- `https://greasyfork.org/en/scripts/371225-atcoderresultnotifier`
- `https://update.greasyfork.org/scripts/371225/AtCoderResultNotifier.user.js` (version 1.0.6, MIT License)
