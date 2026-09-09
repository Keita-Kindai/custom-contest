# ADR-0009: 公開先と認証方式

- Status: Accepted（配備は日曜デモ後。認証は設定待ちの状態まで実装済み）
- Date: 2026-09-05
- Owners: User / Claude Code

## Context

日曜デモまではホストPCで動かす前提だった。デモの次は、友人が任意の時間に開けて、作った問題セットが自分のものとして残る状態にしたい。そのためには公開先と認証を決める必要がある。

現状には2つの制約がある。

- Room stateはNext.js processのメモリ上のMap（`apps/web/src/server/rooms/store.ts`の`RoomStore`）にある。対戦中の画面は1秒ごとにこのstateを読む。
- 問題セットはブラウザーのlocalStorageにしかない（ADR-0007）。端末を変えると同じセットを開けない。作成者名といいね数は暫定値のまま。

Vercelが最初の候補に挙がったが、Vercelはserverlessであり、processが複数instanceへ分かれ、cold startで消える。in-memoryのRoomStoreはその上では成立しない。

## Decision drivers

- 対戦の設計（単一サーバーが共有状態の正本、ADR-0003 / DESIGN-017）を作り直さずに公開したい
- 認証で自分たちが秘密を預からない。パスワードを保存しない
- 無料枠で始められる
- AtCoder IDは自己申告であって身元ではない、という現在の扱いを崩さない

## Options

### 公開先

- **A. Vercel + managed Postgres**: 配備は最も簡単。ただしRoom stateをPostgresかRedisへ移す作業が前提になる。1秒pollingが毎回DBを叩く形になり、対戦の設計を書き直すことになる
- **B. 常駐processのhost（Fly.io / Render）+ Neon Postgres**: 1つのprocessが動き続けるので、今のRoomStoreがそのまま動く。無料枠あり
- **C. ホストPC + tunnel**: 今日と同じ。常時稼働しない

### 認証

- **D. 自前のメール + パスワード**: hash、reset、漏洩対応をすべて自分で持つ。得るものがない
- **E. OAuth（GitHub / Google）**: パスワードを一切保存しない。競プロをする相手はほぼ全員GitHubアカウントを持っている
- **F. AtCoder IDによる本人確認を認証にする**: AtCoderはOAuth providerではない。所有証明を自作することになる

## Decision

公開先はOption B、認証はOption Eを採用する。

**1. 常駐processのhostへ配備する。** Fly.io（またはRender）で1 processを動かし、DBはNeonのPostgresを使う。Vercelは採らない。理由は上記のとおり、Room stateがprocess内にあるため。この制約が消えるのは、Room stateを外部store へ移す判断をした時点であり、それは別のADRとする。

**2. 認証はAuth.js（next-auth v5）で、GitHubとGoogleのOAuthだけを受け付ける。** パスワードは保存しない。sessionはDBに置く（`session.strategy = "database"`）ので、サーバー側からsessionを失効させられる。

**3. AtCoder IDは身元ではない。** `users.atcoder_id`は本人の自己申告として保存するだけで、ログインにも本人確認にも使わない。提出がその人のものだという確認はuserscriptが行う（ADR-0004）。同じAtCoder IDを複数アカウントが名乗る可能性は、この段階では防がない。

**4. secretはリポジトリへ置かない。** `AUTH_SECRET`、`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`はすべて環境変数から読む。`.env.example`には空の項目名だけを置く。

**5. 未設定でもアプリは起動する。** 環境変数が揃っていないproviderは一覧から外れ、`/signin`が「未設定」と表示する。OAuthアプリの登録は人がブラウザーで行う必要があるため、設定前でもbuildとtypecheckが通る形にしてある。

## 設定手順（人が行う）

### ローカル

1. GitHub: Settings → Developer settings → OAuth Apps → New OAuth App。Authorization callback URLは`http://localhost:3000/api/auth/callback/github`。
2. Google: Cloud Console → APIs & Services → Credentials → OAuth client ID（Web application）。Authorized redirect URIは`http://localhost:3000/api/auth/callback/google`。
3. `openssl rand -base64 32`で`AUTH_SECRET`を作る。
4. 5つの値を`apps/web/.env.local`へ書く。
5. `pnpm db:migrate`で`0002_auth`を適用する。
6. `/signin`にログインボタンが出る。providerは環境変数が揃っているものだけ出るので、片方だけでも動く。

### 本番（Vercel + Neon、ADR-0010）

配備先はVercel、DBはNeon。Neonのプロジェクトは**Vercel Marketplaceの統合から作る**。Neonの画面から単体で作ると、接続文字列を手で写すことになるうえ、`DATABASE_URL`がpooledかどうかを自分で確かめる必要がある。統合を使えばpooledの値が入る。

1. VercelへこのrepositoryをImportし、**Root Directoryを`apps/web`**にする。この時点では環境変数が無いのでbuildは失敗してよい。
2. そのVercelプロジェクトの Storage → Neon から統合を追加する。プランは**Free**を選ぶ。`DATABASE_URL`（pooled）と`DATABASE_URL_UNPOOLED`が自動で入る。アプリが読むのは`DATABASE_URL`だけ。
3. 割り当てられたドメインで、**本番用のGitHub OAuth Appをもう1つ**作る。1つのAppにcallback URLは1つしか置けないため、localhost用とは分ける。Authorization callback URLは`https://<ドメイン>/api/auth/callback/github`。
4. Vercelの環境変数へ入れる。`DATABASE_URL`は統合が入れるので手で足さない（二重定義になる）。

   ```
   AUTH_SECRET         openssl rand -base64 32 で新規に作る。localhost用とは別の値
   AUTH_GITHUB_ID      本番用AppのClient ID
   AUTH_GITHUB_SECRET  本番用AppのClient secret
   AUTH_URL            https://<ドメイン>   （任意。下記）
   ```

   `AUTH_URL`は必須ではない。Auth.jsはVercel上でrequestのHostヘッダから自分のURLを組み立てるため、
   利用者が本番ドメインで開く限り正しく動く。明示する意味があるのは、deployごとのURL
   （`custom-contest-a1b2c3.vercel.app`）で開かれたときで、そのままだとcallbackがそのURLになり、
   GitHubに登録した値と一致せずログインが失敗する。1行でその失敗を消せるので置いておく。

5. 再デプロイする。`vercel-build`が`db:migrate`と`db:seed-problems`を順に走らせてから`next build`する。

Googleを足すときは`AUTH_GOOGLE_ID`と`AUTH_GOOGLE_SECRET`を追加して再デプロイするだけでよい。コードの変更は要らない。

### providerを2つ出すときの注意

Auth.jsは既定で、同じメールアドレスでも別providerのaccountを既存のuserへ自動では結び付けない（`allowDangerousEmailAccountLinking`が既定でfalse）。GitHubで登録した人が同じメールでGoogleからログインすると、行が結合されず`OAuthAccountNotLinked`になる。自動結合はprovider側のメール確認に依存し、乗っ取りの経路になりうるため、この既定は変えない。

したがってproviderを2つ出す場合、利用者は最初に使ったほうを覚えている必要がある。明示的なaccount連携の導線は別Issueとする。

## Consequences

- `vercel-build`がdeployのたびにmigrationとカタログの流し込みを走らせる。流し込みを飛ばすと、利用者がカタログの問題を選んだ瞬間に外部キー違反で保存できない（ADR-0011、DESIGN-116）
- Vercel Marketplaceの統合は、ProductionとDevelopmentの両方へ同じ`DATABASE_URL`を入れる。Preview deployが本番と同じDBを触るため、PRごとに使い捨てDBが要るならNeonのPreviews Integrationを別途入れる
- `next-auth@5.0.0-beta.32`はbetaである。App Router + React 19に対応した安定版がまだない。安定版が出たら更新する
- `users`、`accounts`、`sessions`、`verification_tokens`の4 tableが増える。列名はDrizzleAdapterが要求する形に固定される
- ログインが入ると、問題セットの`authorName`、いいね数、公開範囲を実データにできる（ADR-0007のrevisit trigger）。ただしその移行自体はこのADRの対象外
- localStorageに保存済みのセットは、ログイン後のアカウントへ自動では紐づかない。移行方法は別途決める
- Room作成にログインを必須にするかは、まだ決めていない。現状は必須にしていない

## Verification

- 環境変数が未設定でも`pnpm check`が通り、`/signin`が「未設定」と表示する
- `0002_auth`を空DBへ適用でき、同じmigrationの再実行でschemaが壊れない
- GitHubとGoogleの両方でログインでき、同じemailなら同じ`users`行になる
- ログアウトでsession行が消える
- `AUTH_SECRET`とclient secretがブラウザーへ配信されない
- `pnpm audit --prod`が0件

## Revisit triggers

- Room stateを外部storeへ移し、serverlessを選べるようにする
- next-auth v5の安定版が出る
- AtCoder IDの所有確認を認証と結びつける
- 無料枠を超える利用量になる

## Evidence

- `apps/web/src/server/rooms/store.ts`（`RoomStore`はprocess内のMap）
- `apps/web/src/app/_components/battle-room.tsx`（1秒polling）
- `docs/decisions/0003-room-authority.md`
- `docs/decisions/0005-database-access.md`
- `docs/decisions/0007-problem-set-frontend-boundary.md`
