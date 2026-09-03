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

## 文書の書き方

- rootの`AGENTS.md`と`CLAUDE.md`は入口と配置規則だけを書く。
- 詳細が増えたら対象分野の文書へ分け、入口からリンクする。
- 「良い設計にする」ではなく、入力、出力、責任主体、失敗時の処理を書く。
- 制限を書くときは、同じ目的を満たす採用手段も併記する。
- 強調はユーザー判断または危険な不可逆操作に限定する。

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
