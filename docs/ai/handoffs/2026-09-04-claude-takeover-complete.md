# 2026-09-04 Claude Code中断後の引き継ぎ完了

## Goal

Claude Codeが途中で終了したbackend作業を現状の差分から復元し、2026-09-06の友人デモに必要な招待制BO1を、2つの独立したブラウザーで完走できる縦切りにする。

## Recovered state

引き継ぎ開始時点では、`packages/contracts`、Room状態機械、固定問題poolの一部が実装済みだった。一方、HTTP API、PostgreSQL保存、userscript本体、frontendとの接続、API/E2E testは未完成だった。既存差分を保持し、仕様とschemaを正本として不足分を補った。

## Completed

- `packages/contracts`: Room snapshot、操作、userscript通知、保存済みMatch responseのZod schema
- `packages/domain`: 2人参加、READY、Countdown、先着AC、Pending、時間切れ、Forfeit、VOID、再戦、遅着evidenceを扱う状態機械
- `apps/web/src/app/api`: Room作成・参加・操作、userscript link/heartbeat/evidence、Fake evidence、保存済みMatch、healthのRoute Handler
- `apps/web/src/server`: process内Room正本、PostgreSQL保存と5秒retry、90日expiry、固定問題抽選
- `apps/userscript`: 一回限りlink key、接続先限定build、heartbeat、AtCoder提出一覧とstatus JSONの監視、ACKまで残すoutbox
- `apps/web/src/app`: Room作成・参加から2人同期、READY、開始、対戦、勝敗、結果再表示、端末内の直近3件、再戦までserver snapshotへ接続
- 自動検証: domain/API unit test、PostgreSQL round-trip integration test、独立した2 browser contextのPlaywright E2E

## Verification run

- Node 24.19.0 / pnpm 11.19.0で`pnpm check`: pass
- `pnpm audit --prod`: known vulnerabilityなし
- 一時PostgreSQL 18にmigrationを2回適用し、冪等性を確認: pass
- 保存・取得と90日経過後の物理削除を含むVitest 11件: pass
- 一時PostgreSQL 18とproduction Next.js serverを使う`pnpm test:e2e`: pass
- E2EはHost作成、Invitee参加、userscript health、両者READY、開始、Fake AC、両画面の同一結果、保存済み結果の再読込、再戦合意を検査する
- `git diff --check`: pass

画面証跡は`docs/ai/handoffs/screenshots/`にあり、トップ、Room設定、両者READY、Countdown、対戦中、勝敗確定、端末内の直近結果を確認できる。

## Known manual boundary

実際にAtCoderへログインしたTampermonkey環境だけは自動化していない。DOM selector、ログインID取得、提出一覧、status JSONの現在のresponseは、`Litms`またはその場で明示的に許可された友人のデータだけを使い、2026-09-05またはデモ前に手動確認する必要がある。無関係な第三者の公開提出は使わない。

ローカルの通常PostgreSQL serviceは、この引き継ぎ時点では起動していなかった。実装自体は一時PostgreSQL 18で検証済みだが、デモ前に通常serviceを起動し、databaseと`.env.local`を準備する。

生成済みuserscriptの`dist/`はGit管理対象外である。デモで使うLAN IPが決まった後に、その接続先を埋め込んで再buildする。

## Recommended next action

1. `docs/flows/0006-sunday-demo-runbook.md`に沿ってPostgreSQL、`.env.local`、migrationを準備する。
2. ホストPCのLAN URLを指定してuserscriptをbuildし、2台のChrome/Edge + Tampermonkeyへ入れる。
3. `Litms`と許可済みの友人アカウントで、実提出がPendingから最終判定へ変わり、両画面で同じ勝敗になることを手動リハーサルする。
4. 失敗時はFake evidenceへ切り替えられることも同時に確認する。
5. 公開配備、問題pool拡張、問題セット機能、自動Matchmakingは日曜デモ成立後の別Grillingで扱う。
