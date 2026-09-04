# ADR-0006: 日曜デモまでの検証境界

- Status: Accepted
- Date: 2026-09-03
- Owners: User / Codex / Claude Code

## Context

2026-09-06にLAN上の2端末で、Room作成から実AtCoder ACによる結果までをデモする。状態機械、API、2人のブラウザー、Tampermonkey、外部のAtCoderが関係するため、全てを一種類のテストで保証できない。

## Decision drivers

- 勝敗と状態遷移の不具合を高速に再現できる
- 2人の独立したブラウザーで同じ結果になることを確認できる
- 実AtCoderへ自動提出せずuserscriptを検証する
- 起動から結果までの画面をスクリーンショットで確認できる
- 日曜までにテスト基盤の構築へ時間を使い過ぎない

## Options

### Option A: 手動確認だけ

- 初期準備は少ない
- 修正のたびに2端末と実提出が必要になり、状態競合を再現しにくい

### Option B: Vitest、Playwright、実AtCoder手動確認を分担

- ruleとAPIは高速テスト、2人フローはFake判定のbrowser test、外部連携は本人操作で確認する
- test runnerとChromium binaryの依存追加が必要になる

### Option C: Tampermonkeyと実AtCoderまで完全自動化

- 本番に最も近い自動テストになる
- extension付きbrowser、ログイン資格情報、実提出の管理が日曜までの範囲を大きく超える

## Decision

Option Bを採用する。Vitest、PlaywrightのChromium、本人による実AtCoder手動リハーサルを組み合わせる。

## Consequences

- domain rule、状態遷移、API contract、重複、時間はVitestで検証する
- Playwrightの2つのbrowser contextでHostとInviteeを分離し、Fake判定によるend-to-end flowを検証する
- React component専用のtesting libraryとDOM環境は初期段階では追加せず、画面動作をPlaywrightで確認する
- 起動後のトップ、Room設定、待機、カウントダウン、対戦、結果と主要異常状態のscreenshotを保存する
- 初期段階ではpixel単位の画像差分を合否条件にしない
- Tampermonkeyと実提出は自動化せず、`Litms`と明示的に許可された友人のアカウント本人が操作する
- `pnpm check`へ高速テストを含め、Playwrightは`pnpm test:e2e`へ分ける。実装完了時とデモ前には両方を実行する

## Verification

- domainとAPIの失敗が`pnpm check`を失敗させる
- 2つのbrowser contextでRoom作成から再戦までが完走する
- 両画面のMatch ID、問題、状態、勝者が一致する
- 結果ページを再読み込みしてPostgreSQLの保存結果を表示できる
- 主要画面と異常状態のscreenshotがテスト成果物へ保存される
- 2026-09-05と2026-09-06の手動runbookでuserscript heartbeat、Pending submission、最終判定、再送を確認する

## Revisit triggers

- Chrome以外のbrowser対応を保証する
- UIのvisual regressionを自動判定する
- browser extension込みのCIが安定して構築できる
- AtCoderに安全なtest用submission APIが提供される

## Evidence

- `docs/product/mvp.md`
- `design_handoff_ac_duel_bo1/README.md`
- `https://nextjs.org/docs/app/guides/testing/vitest`
- `https://nextjs.org/docs/app/guides/testing/playwright`
- `https://playwright.dev/docs/browser-contexts`
- `https://playwright.dev/docs/test-webserver`
