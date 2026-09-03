# Direct dependency inventory

Last reviewed: 2026-09-03

| Package | Version | Scope | Purpose | Decision |
| --- | --- | --- | --- | --- |
| next | 16.3.4 | runtime | App Router、SSR、Route Handlers | Accepted foundation |
| react | 19.2.8 | runtime | Web UI | Accepted foundation |
| react-dom | 19.2.8 | runtime | React DOM renderer | Accepted foundation |
| zod | 4.5.4 | runtime | API・event・env境界のruntime validation | Accepted foundation |
| typescript | 5.9.3 | development | strict type checking | Accepted foundation |
| eslint | 9.39.5 | development | static analysis | Accepted foundation |
| eslint-config-next | 16.3.4 | development | Next.js / React lint rules | Accepted foundation |
| @types/node | 20.19.43 | development | Node.js type declarations | Transitive development support |
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

## ADR前のため未導入

| Candidate | 判断するADR |
| --- | --- |
| Socket.IO / ws | realtime transport |
| Fastify | HTTP process boundary |
| Drizzle / Prisma | database access |
| Vitest | test strategy |
| Playwright | test strategy |
| Tailwind CSS / component library | Claude Design handoff |
| Redis | room authority and scaling trigger |
