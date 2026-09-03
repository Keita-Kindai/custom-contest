# Custom Contest agent guide

## 最初に読む

1. `CONTEXT.md`
2. `docs/product/mvp.md`
3. `docs/ai/working-agreement.md`
4. 対象機能に対応する `docs/decisions/` と `docs/flows/`

## 作業前

- 画面変更では `docs/design/` の最新仕様を確認する。
- 未決定事項は既存ADRを探す。なければ実装前にADRを作る。
- 新しいnpm依存を追加する前に `docs/security/dependency-policy.md` に従い、inventoryへ記録する。
- APIまたはイベントを変更する場合は、先に `packages/contracts` のZod schemaを更新する。

## 実装の配置

- Web UIと通常HTTP処理: `apps/web`
- リアルタイムサーバー: `apps/realtime`（ADR確定後に作成）
- AtCoder側userscript: `apps/userscript`（通知仕様確定後に作成）
- API・イベント境界のschema: `packages/contracts`
- フレームワーク非依存のルール: `packages/domain`（最初のルール実装時に作成）

## 完了条件

- `pnpm check` が成功する。
- 外部から見える動作変更は対応する仕様またはADRに反映する。
- 依存追加時は `docs/security/dependency-inventory.md` を更新する。
- Claude Designとの不一致は推測で埋めず、`docs/design/open-questions.md` に判断点を記録する。
