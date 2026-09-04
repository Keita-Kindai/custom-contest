# Codex and Claude Code working agreement

## 役割

- Claude Design: 画面構造、状態、component、token、responsive仕様を作る。
- User: product判断とADRの最終承認を行う。
- Codex / Claude Code: ADRと仕様に沿って実装、検証、記録する。

## 引き継ぎ方法

常時会話を前提にせず、repository内の成果物を正本にします。

- 画面仕様: `docs/design/`
- 意思決定: `docs/decisions/`
- 時系列: `docs/flows/`
- 調査中の判断点: 対応する文書のOpen questions
- 作業単位の引き継ぎ: `docs/ai/handoffs/`

## GitHubでの作業単位

- `main`は、いつでもcheckoutして`pnpm check`が通る統合済み状態として扱う。
- 実装前にIssueへ目的と完了条件を書き、Issueごとに`main`から作業branchを作る。
- CodexとClaude Codeは`main`上でファイルを編集せず、直接commit・push・mergeもしない。
- 作業branchで検証後にPRを作り、差分、検証結果、risk、画面変更のscreenshotsを確認してからUserがmergeを判断する。
- 具体的なcommandと例外時の復旧は`docs/ai/git-workflow.md`を正本とする。

## 文書の書き方

- rootの`AGENTS.md`と`CLAUDE.md`は入口と配置規則だけを書く。
- 詳細が増えたら対象分野の文書へ分け、入口からリンクする。
- 「良い設計にする」ではなく、入力、出力、責任主体、失敗時の処理を書く。
- 制限を書くときは、同じ目的を満たす採用手段も併記する。
- 強調はユーザー判断または危険な不可逆操作に限定する。

## 外部ユーザーデータを使う検証

- 公開情報であっても、無関係な第三者のアカウントや提出を動作検証の便宜的なテストデータとして使わない。
- 本人所有、ユーザーが明示したアカウント、明示的に許可された提出、またはリポジトリ内のフィクスチャだけを使う。
- AtCoderの実データを使う検証は、`Litms` またはユーザーがその場で明示した対象に限る。提出コード本文は、機能検証に不要なため取得・保存しない。

## 外部サービスを使う前の確認

- 実装前に`docs/security/external-service-usage.md`を読み、公式の利用規約、個別ルール、API文書、rate limit、データ利用条件を確認する。
- 第三者製scriptや既存サービスは技術的な参考にはなるが、それ自体を利用許可の根拠にはしない。
- 取得するデータ、その理由、送信先、保存期間、アクセス頻度を記録し、懸念点をUserへ伝える。
- 規約が曖昧、内部endpointへ依存、または公開規模へ広げる場合は、実装者一人で適法・許容と断定せず、User判断と別Agent（Codex / Claude Code）の再確認を通す。

## Grillingの単位

プロジェクト全体を一度にGrillせず、ADR一件に必要な境界で行います。
各回の入力は、対象フロー、設計案、候補、判断軸、未決定事項です。出力はADR、必要な実験、次のsequence diagramです。

## 実装開始条件

対象機能について次が揃ってからコードを書きます。

1. 画面または外部境界の仕様
2. Accepted ADR
3. 正常系と主要な失敗系を含むsequence diagram
4. acceptance criteria

起動確認や調査用spikeは、正式実装と区別して文書へ目的を記録します。
