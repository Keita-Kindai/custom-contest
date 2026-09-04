# Issue, branch, and pull request workflow

この文書の目的は、`main`を「常に動く統合済みの状態」に保ち、Codex、Claude Code、Userが同じ手順で変更をレビューできるようにすることです。

## 基本モデル

```text
Issue（何を、なぜ、どこまで行うか）
  ↓
作業branch（未完成の変更を隔離する）
  ↓
local check（壊れていないことを確認する）
  ↓
Pull Request（mainへ入る差分を見せる）
  ↓
review + required checks
  ↓
Userがmerge
  ↓
main
```

branchを作るだけではmainを完全には守れません。このrepositoryでは`.github/workflows/ci.yml`がPRとmain更新時に`pnpm check`を実行します。さらにGitHub側で`main`への直接pushを禁止し、このcheckを必須にして初めて強制できます。

## 1. Issueを作る

機能、bug、調査、文書変更を原則1 Issueに分けます。Issueには最低限、目的、背景、対象範囲、対象外、完了条件、確認方法を書きます。

```sh
gh issue create
```

画像は「見た目が正しいか」を判断する証拠です。画面変更ではbefore / after、問題が起きる状態、期待する状態をIssueまたはPRへ添付します。秘密、token、個人情報、不要な他人のデータが写っていないことを確認します。

## 2. mainを更新して作業branchを作る

未commit変更がないことを確認してから行います。

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/123-short-description
```

分類は次を目安にします。

- `feat/123-...`: 機能
- `fix/123-...`: bug修正
- `docs/123-...`: 文書だけ
- `chore/123-...`: 開発環境や保守

`gh`へlogin済みなら、Issueとbranchの関連付けもできます。

```sh
gh issue develop 123 --base main --name feat/123-short-description --checkout
```

既に`main`上へ未commit変更がある場合は、resetや削除をせず、そのまま新しいbranchを作ります。

```sh
git switch -c feat/short-description
```

## 3. 実装とcommit

作業中も`git status --short`で対象外の変更が混ざっていないか確認します。commit前に次を実行します。

```sh
pnpm check
git diff --check
git diff --staged
```

commit messageは結果が分かる命令形にします。

```text
feat: complete invite-only LAN duel demo
fix: prevent duplicate AtCoder polling
docs: define external-service review policy
```

## 4. PRを作りレビューする

```sh
git push -u origin HEAD
gh pr create --base main --fill --draft
gh pr checks --watch
gh pr diff
```

このMacの`gh 2.98.0`は`gh pr create --attach`にまだ対応していません。PRをbrowserで開き、本文へ画像をdrag & dropして、各画像が何を証明するかを文章で添えます。

```sh
gh pr view --web
```

画像自体をrepositoryへ保存する場合は`docs/ai/handoffs/screenshots/`へ置き、PRには対応するfile pathも書きます。将来`gh`を更新した後、`gh pr create --help`に`--attach`が表示されることを確認できた場合だけCLIからの添付を使います。

PRでは次を分けて確認します。

1. 仕様どおりか
2. security、privacy、外部サービスへの負荷に問題がないか
3. testが変更を証明しているか
4. screenshotsが実際のbrowser表示か
5. 対象外の変更や秘密情報が混ざっていないか

Agentはreview結果と修正を作業branchへ追加できますが、Userの明示許可なしに`main`へmergeしません。

## 5. GitHub側でmainを強制保護する

`gh`認証後、GitHub RulesetまたはBranch protectionで次を設定します。

- 対象branch: `main`
- Pull Request必須
- force push禁止
- branch deletion禁止
- required status check: CI jobの`pnpm check`
- merge前にbranchが最新であることを要求

現在は一人開発なので、必須approval数を1にすると自分のPRを自分で承認できず止まる可能性があります。最初は「PR必須・CI必須・Userがmerge」で運用し、別のGitHub reviewerが参加した時点でapproval 1件必須へ上げます。

## 例外と復旧

- 緊急修正でもmainへ直接commitしない。小さい`fix/` branchとPRを使う。
- check失敗中のPRはmergeしない。無関係な既存失敗なら、原因と証拠をPRへ書き、別Issueへ分離する。
- 誤ってmain上で編集しただけなら、未commit変更を保ったまま`git switch -c`する。
- 誤ってmainへcommitした場合は、公開済み履歴をresetやforce pushで書き換えず、状況を確認してrevertまたは新しい保護branchへの移行をUserと決める。
