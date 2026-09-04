# ADR-0005: 完了MatchのPostgreSQL永続化

- Status: Accepted
- Date: 2026-09-03
- Owners: User / Codex / Claude Code

## Context

完了したMatch、VOID理由、提出履歴をサーバー再起動後も再表示する。初期段階で永続化する中心データは少ないが、今後ユーザー、問題セット、履歴検索へ拡張する。日曜デモではホストPCのPostgreSQL 18を使い、両ParticipantのブラウザーはDBへ直接接続しない。

## Decision drivers

- Next.jsとTypeScriptから安全にPostgreSQLへアクセスできる
- schema変更をレビュー可能なSQLとして履歴へ残せる
- 日曜までにmigration、保存、再表示を検証できる
- 将来テーブルと検索条件が増えても全面的に書き直さない
- DB障害が進行中のMatchを中断しない

## Options

### Option A: `pg`と手書きSQL

- 依存と抽象化が最小で、少数のqueryを早く実装できる
- 型とschema変更の対応を手作業で維持する

### Option B: Drizzleと`pg`

- TypeScript schemaからqueryを組み立て、SQL migrationを生成・確認できる
- ORM、migration tool、設定、依存審査が増える

### Option C: Prisma

- 独自schema、生成client、migration CLI、PostgreSQL adapterを使う
- 高機能だが初期構成と生成工程が今回の小さい永続化境界には多い

## Decision

Option Bを採用する。Drizzleと`pg`をNext.jsのserver側だけから利用し、TypeScript schemaと連番SQL migrationをrepositoryへ保存する。

日曜デモではホストPCに導入済みのPostgreSQL 18を使い、Dockerを必須にしない。両ParticipantのブラウザーはCustom Contest APIだけへ接続し、DB資格情報を持たない。

## Consequences

- dependency policyに従って`drizzle-orm`、`drizzle-kit`、`pg`、型定義のversion、license、install scriptを確認してから追加する
- server moduleで共有Poolを管理し、Client ComponentへDB moduleをimportしない
- 起動時にDB接続とmigration状態を検査し、失敗時はRoom作成を許可しない
- 完了Matchと提出履歴は90日間保持し、起動時と1日1回のアクセス時に期限切れデータを削除する
- VOIDは理由と結果URLを保存するが戦績対象外とする
- 対戦中のDB停止ではMatchを継続し、結果保存を5秒間隔で再試行する。保存完了まで再戦を許可しない
- 結果保存前のserver process終了による未保存結果の消失は日曜デモで許容する

## Verification

- migrationを空DBへ適用し、同じmigrationの再実行でschemaが壊れない
- HostとInviteeのブラウザーへDB資格情報やDB queryが配信されない
- WIN、DRAW、Forfeit、VOIDと提出履歴を保存し、server再起動後に限定公開URLで再表示できる
- DBを一時停止してもactive Matchが継続し、復旧後に結果が一度だけ保存される
- 保存中は再戦できず、保存完了後に自動で有効になる
- 90日を過ぎたMatchと提出履歴が削除され、期限切れURLへ説明が表示される

## Revisit triggers

- PostgreSQLを外部managed serviceへ移す
- 複数server processから同じactive Roomを扱う
- relationやqueryの複雑化でDrizzleが開発を妨げる
- migration運用をCI/CDへ組み込む

## Evidence

- `docs/product/mvp.md`
- `docs/security/dependency-policy.md`
- `https://orm.drizzle.team/docs/get-started-postgresql`
- `https://orm.drizzle.team/docs/migrations`
- `https://node-postgres.com/`
