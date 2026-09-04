# ADR-0003: Room状態の正本

- Status: Accepted
- Date: 2026-09-03
- Owners: User / Codex / Claude Code

## Context

2人のブラウザー、AtCoder userscript、通常HTTP APIが同じMatchへ入力する。各ブラウザーが独自にREADY、開始時刻、勝敗を確定すると、通信遅延や再読み込みによって参加者ごとの表示と結果が食い違う。

## Decision drivers

- 2人に同じMatch結果を表示する
- 不正または古い操作で状態を巻き戻さない
- 再読み込み後に一つのsnapshotから復帰できる
- 日曜デモではRedisなしの単一プロセスで完結する

## Options

### Option A: サーバーを正本にする

- ブラウザーとuserscriptは操作またはevidenceを送り、サーバーだけが共有状態を変更する
- 再接続時はサーバーの最新snapshotを取得する

### Option B: 各ブラウザーを正本にする

- 参加者ごとにローカル状態を進め、相互に同期する
- 同時操作、切断、勝敗競合をブラウザー同士で解決する必要がある

## Decision

Option Aを採用する。両者READYのあとホストの開始要求をサーバーが再検査し、3秒カウントダウンへ進める。カウントダウンはどちらも中止でき、両者のREADYを解除する。

## Consequences

- Room、Match、Round、READY、問題、時刻、提出、勝敗は単一Next.jsサーバープロセスが管理する
- ブラウザーは操作の意図だけを送り、受理された結果をsnapshotで表示する
- Match開始はホストだけが要求でき、サーバーが両者のREADYとuserscript接続を再検査する
- 参加者キー、userscript接続設定、共有されないUI状態だけは端末へ保存できる
- activeなRoomとMatchはプロセス内で管理し、サーバー再起動時の復旧を保証しない
- 完了したMatchだけをPostgreSQLへ保存する
- VOIDも原因とともに保存するが、戦績や直近の対戦には含めない
- 自動的な切断負けは設けず、明示的なForfeitだけを相手の勝利として確定する
- Forfeitは対戦中の確認モーダルで確定し、理由とともに完了Matchへ保存する
- 一時切断では席を残し、Inviteeの明示的退出では席を解放する。ホストの明示的なRoom終了ではRoomを閉じ、ホスト権限は譲渡しない
- Waiting中はホストが確認後にInviteeの席を解放でき、対象の参加者キーとuserscript専用トークンを無効にする。Countdown開始後と対戦中は許可しない
- 再戦は両者の承認後、同じRoomと条件に新しいMatchを作り、問題を再抽選する
- 対戦中ではなく両者のアプリ接続がないRoomは、30分後に自動で閉じる

## Verification

- 同時または重複したREADY操作でも許可された状態遷移だけが起きる
- 古いpolling応答が新しいsnapshotを上書きしない
- 再読み込みした参加者が参加者キーで元の席と最新状態へ復帰する
- 同じMatchへの競合するACまたはForfeitのうち、サーバーが最初に確定した結果だけが残る
- カウントダウン中にどちらかが中止すると両者のREADYが解除され、問題が公開されない
- Invitee退出後に席が空き、ホストのRoom終了後は再参加できない
- ホストがWaiting中にInviteeの席を空けると、古い参加者キーとuserscript専用トークンでは再参加・通知できない
- 再戦で新しいMatch IDと問題が作られ、過去Match URLの内容が変化しない
- 推測困難なMatch URLを知る閲覧者が結果を再表示できるが、編集操作はできない
- 非対戦中かつ両者無接続のRoomだけが30分後に閉じられる
- サーバー再起動後、active Matchは復元せず、完了したMatch URLは再表示できる

## Revisit triggers

- Next.jsプロセスを複数起動する
- active Matchの再起動復旧が必要になる
- Redisなどの共有状態ストアを導入する
- 1Roomが3人以上または観戦者を持つ

## Evidence

- `docs/product/mvp.md`
- `docs/decisions/0001-mvp-boundary.md`
- `docs/decisions/0002-realtime-transport.md`
- `design_handoff_ac_duel_bo1/README.md`
