# Claude Code guide

このリポジトリではCodexとClaude Codeがファイルを介して引き継ぎます。

開始時に `AGENTS.md` と `docs/ai/working-agreement.md` を読み、対象機能のADR、シーケンス図、画面仕様を確認してください。

読み取り以外の作業では、編集前に現在branchを確認し、`main`なら必ずIssue対応の作業branchを作ってください。`main`へ直接commit、push、mergeしてはいけません。Git運用の詳細は`docs/ai/git-workflow.md`を正本とします。

設計上の疑問は `docs/design/open-questions.md`、意思決定は `docs/decisions/`、作業引き継ぎは `docs/ai/handoffs/` に残します。
