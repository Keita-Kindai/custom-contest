# ADR-0001: 友人向けBO1縦切りMVP

- Status: Accepted
- Date: 2026-09-03
- Owners: User / Codex / Claude Code

## Context

2026-09-06に友人と非公開Roomでデモする。画面HandoffはローカルモックのUI試作を指示している一方、プロダクトMVPは2人の参加者への同期と結果保存を求めており、次に実装する境界を明確にする必要がある。

## Decision drivers

- 友人2人が独立したブラウザーから一連の対戦を体験できる
- AtCoder連携の不確実さと、対戦基盤の不具合を切り分けられる
- 公開対戦やレーティングに必要な不正対策に、デモ前の時間を使い過ぎない
- 将来のAtCoder提出連携を追加しても、対戦の基本フローを作り直さない

## Options

### Option A: ローカルUI試作

- 1つのブラウザー内のモックとデバッグパネルで全状態を再現する
- 画面は早く検証できるが、2人間の同期は検証できない

### Option B: Fake ACの縦切り

- 2つの独立したブラウザーがサーバー管理のRoomに参加する
- AtCoder提出連携はFake ACで代替し、Room作成から結果再表示までを通す

### Option C: AtCoder提出連携まで含む

- 実際の提出検知と検査まで最初の境界に入れる
- 本番に近いが、提出取得と対戦同期を同時に調べることになり、デモまでのリスクが高い

## Decision

Option Bを先に完走させ、日曜デモではOption Cのうちuserscriptによる提出判定通知までを必須とする。初回は招待した友人同士の非公開Roomとし、ランキングとレーティングは対象外とする。プロダクト上は両参加者に識別情報を求めるが、初回デモでは本番認証の代わりに、AtCoderへの本人確認を行わない開発用プロフィールを使う。

デモは同一ネットワーク上の2台の端末を基準とし、同一端末の2セッションをフォールバックとする。Room作成ではBO1を固定し、制限時間の選択だけを可変とし、問題抽選範囲は固定する。完了したMatchはPostgreSQLに保存して再起動後も再表示可能とするが、進行中のRoomとMatchはプロセス内だけで管理する。

日曜用の固定問題範囲はABC C/D、Difficulty目安400〜1200とする。初期段階では両者のAC済み問題を除外せず、AtCoder Problems連携を拡張するときに除外設定を再検討する。Ratingは表示せず、Difficultyは非公式の「目安」として扱う。

デモの保証対象は横幅1024px以上とし、招待URLを主な参加導線、Room ID入力を代替導線とする。RoomとMatchのURLを分け、過去のMatch結果に安定したURLを与える。ページ再読み込み後の席の回復には、AtCoder IDとは別の参加者キーを使う。

日曜デモでは両参加者がChromeまたはEdgeでTampermonkeyへ専用userscriptをインストールする。サーバーが検査済みのAC evidenceを最初に受理した参加者を即時に勝者とし、AtCoder上の提出時刻が同じ秒でも引き分けにはしない。確定後に届いたACによって結果を変更しない。

userscriptと参加者は、一度だけ使える接続キーをAtCoder URLのfragmentで受け渡して対応付ける。対戦中に15秒以上接続確認が途切れてもタイマーは止めず、警告を表示して自動再接続と再送を行う。時間切れ時に制限時間内のPending submissionが残っていれば、最大5分間だけ最終判定を待つ。全て非ACならDRAW、確認不能ならVOIDとする。

Fake提出はLANデモ、開発、自動テストだけに置き、最初の公開版には含めない。最初の公開版もInvite-only Roomとカジュアル対戦を維持し、厳密な不正対策より公開までの速度を優先する。

## Consequences

- 対戦画面だけでなく、Room作成、参加、READY、開始、Fake AC、勝敗確定、結果再表示を一本のフローとして作る
- `AtCoderResultNotifier` の方式を参考に、AtCoderの提出一覧DOMから判定待ちの提出IDを集め、AtCoder内部の判定確認URLから確定判定を得る
- userscriptは判定をSubmission evidenceとしてCustom ContestのAPIへ通知し、Matchの勝敗はサーバー側の検査後に確定する
- インストール不要方式よりも、日曜デモでの自動検知と安定性を優先してTampermonkeyを必須とする
- ポーリング間隔による到着順の運もデモ版のルールとして受け入れ、最初にサーバーが受理した有効ACで結果を確定する
- 一時切断による時計の停止や悪用を避けるため、userscriptの接続が途切れてもMatchのタイマーは進める
- 時間内に行われた提出を時間切れ直後に捨てないため、Pending submissionの存在だけは最終判定とは別に通知する
- デバッグパネルは試作の代替ではなく、状態再現とテストの補助として残す
- 各参加者が自分のFake提出を発生させる「デモ操作」は、通常時は折りたたんで表示する
- Fake提出はuserscript完成前の検証、自動テスト、およびデモ障害時の復旧手段として残す
- Fake提出のUIと受付経路は公開版で無効にする
- 進行中にサーバーを再起動したRoomは復旧対象にせず、完了したMatchだけを永続化する
- 日曜はAtCoder Problemsから事前生成した固定JSONを使い、Match中は外部APIへ依存しない
- 同じRoomでは全候補を使い切るまで問題を重複させず、抽選seedをMatchへ保存する

## Verification

- 2つの独立したブラウザーセッションで、Room作成から結果確認までの正常系を通す
- 一方のFake ACが、両方の画面で同じMatch結果になることを確認する
- AtCoderの対象問題への実提出が確定したとき、userscript経由で両方の画面に同じ判定が反映されることを確認する
- 接続キーが一度だけ使用でき、対応付け後にAtCoderのURLから消えることを確認する
- userscriptの接続確認が15秒途切れてもタイマーが停止せず、警告後に再接続できることを確認する
- 時間内のPending submissionが時間切れ後にACとなる場合、最大5分の待機中に勝者へ反映されることを確認する
- Pending submissionが全て非ACならDRAW、5分以内に確認不能ならVOIDになることを確認する
- ページ再読み込み後にサーバーの確定状態へ復帰できることを確認する
- サーバーを再起動しても、完了済みMatchの結果URLを再表示できることを確認する
- 招待URLとRoom IDのどちらからも同じRoomへ参加できることを確認する

## Revisit triggers

- 知らない利用者同士の公開マッチングを追加する
- 勝敗をレーティングやランキングへ反映する
- userscript以外の方式でAtCoderの実提出を取得する
- AtCoder Problemsの定期取込と、ほぼ全問題からの条件抽選を実装する

## Evidence

- `docs/product/mvp.md`
- `design_handoff_ac_duel_bo1/README.md`
- `https://greasyfork.org/en/scripts/371225-atcoderresultnotifier`
- `https://update.greasyfork.org/scripts/371225/AtCoderResultNotifier.user.js` (version 1.0.6, MIT License)
