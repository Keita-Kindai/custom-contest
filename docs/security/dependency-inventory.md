# Direct dependency inventory

Last reviewed: 2026-09-04

| Package | Version | Scope | Purpose | Decision |
| --- | --- | --- | --- | --- |
| next | 16.3.4 | runtime | App Router、SSR、Route Handlers | Accepted foundation |
| react | 19.2.8 | runtime | Web UI | Accepted foundation |
| react-dom | 19.2.8 | runtime | React DOM renderer | Accepted foundation |
| zod | 4.5.4 | runtime | API・event・env境界のruntime validation | Accepted foundation |
| drizzle-orm | 0.45.2 | server runtime | PostgreSQLの型付きqueryと完了Match保存 | ADR-0005 / Apache-2.0 |
| pg | 8.23.0 | server runtime | Next.js Node processからPostgreSQL 18へ接続 | ADR-0005 / MIT |
| typescript | 5.9.3 | development | strict type checking | Accepted foundation |
| eslint | 9.39.5 | development | static analysis | Accepted foundation |
| eslint-config-next | 16.3.4 | development | Next.js / React lint rules | Accepted foundation |
| drizzle-kit | 0.31.10 | development | Drizzle schemaの確認・将来のmigration生成 | ADR-0005 / MIT |
| vitest | 5.0.0 | development | domain rule・Route Handler・DB integration test | ADR-0006 / MIT |
| @playwright/test | 1.62.1 | development | ChromiumのHost/Invitee 2-context E2Eとscreenshot | ADR-0006 / Apache-2.0 |
| esbuild | 0.28.2 | development | Tampermonkey userscriptの単一file build | Userscript build / MIT |
| @types/node | 20.19.43 | development | Node.js type declarations | Transitive development support |
| @types/pg | 8.23.1 | development | pgのTypeScript型 | ADR-0005 support |
| @types/react | 19.2.18 | development | React type declarations | Transitive development support |
| @types/react-dom | 19.2.5 | development | React DOM type declarations | Transitive development support |

## Compatibility exception

`eslint@9.39.5` はregistry上でsupport終了と表示されます。2026-09-03時点の `create-next-app@16.3.4` がTypeScript + ESLint構成に `eslint: ^9` を生成するため、Next.js公式構成との互換性を優先して一時採用しています。`pnpm audit --prod` は既知脆弱性0件です。

次のいずれかで再検討します。

- `create-next-app` がESLint 10を生成する。
- `eslint-config-next` と同梱plugin群のESLint 10対応を、strict peer dependencies下で確認できる。
- Biomeへ移行するADRをAcceptedにする。

## Reviewed build scripts

| Transitive package | Version | Introduced by | Script | Decision |
| --- | --- | --- | --- | --- |
| unrs-resolver | 1.12.2 | eslint-config-next | `node postinstall.js`: 適合するN-API bindingの存在を確認し、不足時だけ取得する | pnpm `allowBuilds`で許可。lockfile上のoptional bindingを利用することをinstall logで確認する |
| esbuild | 0.28.2 | userscript build | `node install.js`: platform binaryの存在・versionを検査し、不足時に取得する | pnpm `allowBuilds`で許可。lockfileのplatform packageを利用 |

## GitHub Actions

| Action | Release | Commit SHA | Purpose | Decision |
| --- | --- | --- | --- | --- |
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | PRとmainのsource checkout | 公式Action / MIT / SHA固定 |
| actions/setup-node | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` | CIでNode 24.19.0を用意 | 公式Action / MIT / SHA固定 |

CI tokenは`contents: read`だけを許可し、外部からのPR codeへrepository secretを書き込み可能な権限を渡しません。pnpmはCorepackから`11.19.0`を明示して使用します。

## 未導入

| Candidate | 判断するADR |
| --- | --- |
| Socket.IO / ws | realtime transport |
| Fastify | HTTP process boundary |
| Tailwind CSS / component library | Claude Design handoff |
| Redis | room authority and scaling trigger |
