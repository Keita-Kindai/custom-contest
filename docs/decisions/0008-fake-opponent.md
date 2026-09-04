# ADR-0008: 一人で実提出を検証するためのテスト相手

- Status: Accepted
- Date: 2026-09-04
- Owners: User / Codex

## Context

実際のAtCoder提出がuserscriptからserverへ届き、勝利へ反映される流れを確認するには、Roomの2席が埋まり両者がREADYである必要がある。毎回2台目のPCと別のAtCoderアカウントを用意すると、本人の提出経路だけを短時間で繰り返し確認しにくい。

## Decision

Fake機能が有効なLANデモ・開発・自動テスト環境に限り、Hostが空のInvitee席へ`FAKE_RIVAL`を追加できるようにする。

- テスト相手は自動READYになる
- AtCoderへ接続せず、heartbeatや提出を発生させない
- Host本人のuserscript接続、ID一致、判定先アクセス、READY条件は省略しない
- Hostの実提出は通常のuserscript APIとdomain検査を通す
- Hostが再戦を申し込んだ場合だけ、テスト相手の承認を自動化して待機へ戻す
- 通常のInviteeがいるRoom、開始済みのMatch、Fake機能が無効な環境では追加を拒否する

## Consequences

一人でも自分側の実提出経路と勝利判定を検証できる。一方、相手側のuserscript、提出、通信切断は検証できないため、2人での最終リハーサルは引き続き必要である。

テスト相手は外部サービスを利用しない。`CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE=1`を公開環境で有効にしないという既存の運用境界を共有する。

## Verification

- Hostだけが空席へ追加できる
- Fake機能が無効ならAPIを公開せず404相当で拒否する
- テスト相手はREADYだが、Hostは正常なuserscript接続なしにREADY・開始できない
- テスト相手を追加した後、Hostの実ACが通常の先着ACルールで勝利になる
- Match中にテスト相手を外せない
- 再戦では同じRoomとテスト相手を使って待機へ戻れる

## Revisit triggers

- テスト相手が自動提出する動作を追加する
- 公開環境でも一人練習モードを提供する
- Match結果をランキングやレーティングへ使う
