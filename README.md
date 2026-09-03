# Custom Contest

競技プログラミングの問題セット作成、練習、友達との対戦、共有を一つにつなぐプラットフォームです。

## 現在の状態

実装開始前の基盤です。Next.js の起動確認用ページと、設計・ADR・依存関係審査の置き場を用意しています。
画面設計を取り込んだ後、ADRとシーケンス図を確定してMVP実装へ進みます。

## 必要な環境

- Node.js 24.19.0
- pnpm 11.19.0
- PostgreSQL（接続を実装するADRの後に利用開始）

## 起動

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`http://localhost:3000` を開きます。

## 検証

```bash
pnpm check
pnpm audit --prod
```

## ドキュメント入口

- プロダクト: `docs/product/`
- Claude Designの成果物: `docs/design/`
- ADR: `docs/decisions/`
- シーケンス図: `docs/flows/`
- 依存関係とアセットの安全性: `docs/security/`
- Codex / Claude Codeの共同作業: `docs/ai/working-agreement.md`
