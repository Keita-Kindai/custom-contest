# 一般公開の準備手順（本人作業）

この文書は、Userだけが実行できる作業をまとめたものです。Agentはアカウント、ダッシュボード、OAuthアプリの登録に触れません。ここが終わるまで、負荷試験・復旧試験・本番相当のsmoke testは始められません。

対象は精進側（Discover・問題セット・ライブラリ）の公開だけです。AC Duelは別の判定とし、この文書の範囲外です（ADR-0010）。

関連文書:

- 公開先とDBの決定: `docs/decisions/0010-practice-first-deployment-and-database.md`
- 認証とOAuthの手順: `docs/decisions/0009-deployment-and-auth.md`
- branchとPRの運用: `docs/ai/git-workflow.md`

## 作業の順番

依存があるので、この順に進めてください。とくに **E（ロール分離）は途中でAgent側のコード変更を挟みます**。順番を入れ替えると、次のdeployでmigrationが失敗します。

| | 作業 | 所要 | これが無いと止まるもの |
|---|---|---|---|
| A | 3件の判断を決める | 5分 | Agentのコード作業 |
| B | GitHubのmain保護を実効化する | 10分 | CIをゲートとして使えない |
| C | Vercel CLIへログインする | 10分 | Agentが環境変数とlogを読めない |
| D | PreviewのDBをProductionから分ける | 20分 | 隔離環境での試験すべて |
| E | migration用と実行時用のロールを分ける | 30分 | — |
| F | 本番OAuthアプリを登録する | 30分 | ログインを要する機能の検証すべて |
| G | 本番の環境変数を確認する | 15分 | — |
| H | バックアップの置き場所を決める | 20分 | 復旧試験 |
| I | 費用と使用量のアラートを入れる | 10分 | — |

---

## A. 3件の判断

Agentの作業がこの3つで止まっています。決めた内容をそのまま返信してください。

### A-1. PR #31 をmergeするか

`perf: stop unauthenticated reads from costing a database round trip`。CIは通っています。draftも解除済みです。mergeするか、先に直したい点があるかを決めてください。

### A-2. レート制限の方式

現在、アプリ内にレート制限の実装がありません。未認証で叩ける経路が複数あるため、公開前に必要です。3つの選択肢があります。

- **Vercel WAFのrate limitルール** — 追加の依存もコードも要りません。ダッシュボードで経路ごとに設定します。アプリより手前で止まるので、Function実行数も節約できます。Hobbyプランで使える範囲を確認する必要があります。
- **Upstash Redis（Vercel Marketplace）** — アプリ内で細かく制御できます。ログインユーザー単位の制限を正確にかけられます。依存が1つ増え、無料枠の上限が別にできます。
- **先送り** — 招待制ベータの人数が把握できている間だけなら成立しますが、一般公開はできません。

推奨は**Vercel WAF**です。理由は、依存を増やさず、アプリへ到達する前に止まるためです。ログインユーザー単位の制限が必要になった時点でUpstashを足す、という順序にできます。

### A-3. setIdをサーバー生成へ移すか、既存セットをどうするか

限定公開は `set_id` の推測しにくさだけで守られていますが、その値を**ブラウザーが作ってサーバーがそのまま受け取っています**。サーバーが秘密を管理していない状態です。

移す場合、既存のセットをどうするかを決める必要があります。

- 旧IDをそのまま残し、新規作成分だけサーバー生成にする（URLが変わらない。移行不要）
- 全部を作り直してリダイレクトを張る（共有済みURLが一度切れる）

まだ利用者がいないなら前者で十分です。

---

## B. GitHubのmain保護を実効化する

**現状、`main`は実質的に保護されていません。** `Main Protection` というrulesetは有効ですが、中身は削除禁止とforce push禁止の2つだけです。Pull Request必須でもなければ、CIの成功も要求していません。つまり、いま誰でも（Agentも）`main`へ直接pushでき、CIが落ちているPRもmergeできます。

`docs/ai/git-workflow.md` の第5節はこの設定を前提に書かれているので、実物を合わせます。

1. https://github.com/Keita-Kindai/custom-contest/rules/22273299 を開く
2. Rules に次を追加する
   - **Require a pull request before merging** — Required approvals は **0** のままにする（一人開発なので1にすると自分のPRを承認できず止まる）
   - **Require status checks to pass** → **Require branches to be up to date before merging** を有効化 → 検索窓で `pnpm check` を追加
3. Save changes

確認:

```bash
gh api repos/Keita-Kindai/custom-contest/rulesets/22273299 --jq '[.rules[].type]'
```

`["deletion","non_fast_forward","pull_request","required_status_checks"]` の4つが並べば完了です。

### B-2. Dependabotのsecurity updatesを有効にする

現在 `dependabot_security_updates` が `disabled`、脆弱性アラートも無効です。バージョン更新のPRは届いていますが、**脆弱性が出たときの通知が来ない状態**です。

1. https://github.com/Keita-Kindai/custom-contest/settings/security_analysis を開く
2. **Dependabot alerts** を Enable
3. **Dependabot security updates** を Enable

Secret scanningとpush protectionは既に有効です。このリポジトリは**public**なので、この2つは特に効いています。

---

## C. Vercel CLIへログインする

これをやると、Agentが環境変数の一覧、デプロイの状態、ランタイムlog、使用量メトリクスを読めるようになります。以降のD〜Iの確認をAgent側で自動化できます。

```bash
npm i -g vercel
```

```bash
vercel login
```

```bash
cd /Users/keita/repos/Custom-Contest && vercel link --yes --project custom-problems
```

確認:

```bash
vercel env ls
```

環境変数の**名前だけ**が一覧されます。値は表示されません。

> **注意**: `vercel env pull` は値を平文で `.env.local` に書き出します。`.gitignore` に入っているのでcommitはされませんが、必要なとき以外は実行しないでください。

### Vercel MCPについて

`plugin:vercel:vercel` のMCPサーバーは未認証です。このsessionは非対話なのでOAuthを実行できません。使うなら、対話的な `claude` で `/mcp` から認可してください。

ただし **CLIへログインすれば、MCPが無くてもAgentは同じことができます**（環境変数、デプロイ、log、メトリクス、firewallルール）。先にCLIを済ませるのが早いです。

---

## D. PreviewのDBをProductionから分ける

ADR-0010のConsequencesに、この問題が書かれています。

> Vercel Marketplaceの統合は、ProductionとDevelopmentの両方へ同じ `DATABASE_URL` を入れる。Preview deployが本番と同じDBを触る

つまり現状、**PRのPreviewデプロイが本番のDBへmigrationを流している可能性があります**。負荷試験を隔離環境でやる前提が崩れるので、ここを先に切ります。

1. https://vercel.com/keitas-projects-20de2bed/custom-problems の **Storage** を開く
2. Neonの統合から **Neon Previews Integration**（PRごとにNeonのbranchを作る仕組み）を追加する
3. Settings → Environment Variables で `DATABASE_URL` を確認する
   - **Production** にだけ本番の値が入っていること
   - **Preview** は Previews Integration が差し込む値になること
   - Production の値が Preview にも入っている状態なら、Preview側のチェックを外す

確認:

```bash
vercel env ls
```

`DATABASE_URL` の Environments 欄が Production と Preview で別れていれば完了です。

---

## E. migration用と実行時用のDBロールを分ける

### なぜやるか

いまは1つのロールがすべてを持っています。そのロールの接続文字列が漏れると、読み書きだけでなく **テーブルの削除までできます**。実行時のアプリに必要なのは `SELECT / INSERT / UPDATE / DELETE` だけで、DDLは要りません。

分けておくと、アプリ側に穴があっても、そこから `DROP TABLE` へは届きません。

### 手順（3段階に分けてください）

**E-1. 実行時用ロールを作る（User）**

Neonのコンソール → SQL Editor を開き、**現在のオーナーロール**（Neonの既定では `neondb_owner`）で次を実行します。`<強いパスワード>` と `<オーナーロール名>` は置き換えてください。

```sql
CREATE ROLE app_runtime WITH LOGIN PASSWORD '<強いパスワード>';

-- schemaは見えるようにするが、CREATE は与えない（= DDLを実行できない）
GRANT USAGE ON SCHEMA public TO app_runtime;
REVOKE CREATE ON SCHEMA public FROM app_runtime;

-- 既存テーブルへの読み書き
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- これから migration が作るテーブルにも、同じ権限を自動で付ける。
-- これを忘れると、次に migration を入れた瞬間に実行時が permission denied で落ちる。
ALTER DEFAULT PRIVILEGES FOR ROLE <オーナーロール名> IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE <オーナーロール名> IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
```

分離できたことの確認。`app_runtime` で接続して次を実行し、**失敗すること**を確かめます。

```sql
CREATE TABLE should_fail (id int);
```

`ERROR:  permission denied for schema public` が返れば正しい状態です。成功してしまったら `REVOKE CREATE` が効いていません。

**E-2. `MIGRATION_DATABASE_URL` を足す（User）**

Vercel の環境変数へ、**Productionだけ**に次を追加します。

```
MIGRATION_DATABASE_URL = <オーナーロールの接続文字列>
```

この時点では `DATABASE_URL` はまだ触らないでください。スクリプト側がまだこの変数を読まないため、先に切り替えるとdeployが壊れます。

**E-3. スクリプトを新しい変数へ向ける（Agent）**

`scripts/migrate.ts` と `scripts/seed-problems.ts` が `MIGRATION_DATABASE_URL` を優先して読み、無ければ `DATABASE_URL` に落ちるようにします。ローカル開発では1つのロールのままで動き続けます。PRを出します。

**E-4. `DATABASE_URL` を実行時ロールへ切り替える（User、E-3のmerge後）**

Vercel の Production の `DATABASE_URL` を `app_runtime` の接続文字列へ差し替え、再デプロイします。

確認するもの:

- デプロイのbuild logに `applied 0001_match_results` … が出る（= migrationはオーナーロールで通っている）
- `/api/health` が `ok: true` を返す
- 問題セットを1つ作成できる（= 実行時ロールの書き込み権限がある）

> `sslmode` は接続文字列に `require` が入っていれば、アプリ側が `verify-full` へ固定します（PR #28）。手で書き換えないでください。

---

## F. 本番OAuthアプリを登録する

### 「これをやると検証ができるようになる」のか

**ログインを要する機能については、そのとおりです。** いま `/signin` はOAuthが未設定なら「未設定」と表示するだけなので、ログインできません。ログインできないと、精進側の主要な機能がまるごと試せません。

- 問題セットの作成・編集・削除
- いいね、保存、最近使用、挑戦状態
- マイページ（ライブラリ）
- 公開範囲の切り替えと、他人から見えるかどうか

つまり公開範囲と認可の検証、つまりリリース判定の中心部分が、ここを済ませるまで一切できません。

ただし区別が1つあります。

- **CIの自動テスト** には実OAuthを使いません。隔離環境だけで通るテスト用の認証経路を使います（Agent側で用意します）。実OAuthをCIに入れると、外部サービスの都合でCIが落ちるようになります。
- **実OAuthが要るのは**、Previewでの手動smoke testです。callbackが実際に往復するか、Cookieの属性が正しいか、providerを2つ出したときの挙動はどうか。これは自動化しません。

### 手順

ADR-0009 の「本番（Vercel + Neon、ADR-0010）」に手順があります。要点だけ再掲します。

1. 本番ドメインを確定する（`custom-problems.vercel.app` か、独自ドメイン）
2. **本番用のGitHub OAuth Appを新しく作る**。localhost用とは別にします。1つのAppにcallback URLは1つしか置けません。
   - Authorization callback URL: `https://<本番ドメイン>/api/auth/callback/github`
3. Google も同様に、Cloud Console で本番用のOAuth client IDを作る
   - Authorized redirect URI: `https://<本番ドメイン>/api/auth/callback/google`
   - scopeは既定のまま。`openid email profile` 以上を要求しない
4. `AUTH_SECRET` を**新規に**作る。localhost用とは別の値にする

```bash
openssl rand -base64 32
```

5. Vercel の Production 環境変数へ入れる

```
AUTH_SECRET          手順4で作った値
AUTH_GITHUB_ID       本番用AppのClient ID
AUTH_GITHUB_SECRET   本番用AppのClient secret
AUTH_GOOGLE_ID       本番用のClient ID
AUTH_GOOGLE_SECRET   本番用のClient secret
AUTH_URL             https://<本番ドメイン>
```

`AUTH_URL` は必須ではありませんが、deployごとのURL（`custom-problems-a1b2c3.vercel.app`）で開かれたときにcallbackが一致せず失敗するのを1行で防げます。入れておいてください。

> **Previewでも実OAuthを試すなら**、Preview用にもう1つApp（callbackはPreviewのドメイン）が要ります。Previewのドメインはデプロイごとに変わるため、固定のPreview URLを1つ決めてそこに合わせるのが現実的です。ここは後回しでも構いません。

### 注意（ADR-0009より）

同じメールアドレスでも、GitHubで登録した人がGoogleからログインすると `OAuthAccountNotLinked` になります。これは仕様です（自動結合は乗っ取り経路になるため既定で無効）。ベータの参加者へは「最初に使ったほうを覚えておいてください」と伝えてください。

---

## G. 本番の環境変数を確認する

Cへログイン済みなら、一覧はコマンドで取れます。

```bash
vercel env ls
```

Production に**あるべきもの**:

```
DATABASE_URL             app_runtime の接続文字列（E-4のあと）
MIGRATION_DATABASE_URL   オーナーロールの接続文字列
AUTH_SECRET
AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
AUTH_URL
```

Production に**あってはいけないもの**:

```
CUSTOM_CONTEST_ENABLE_BATTLE          立っていたら対戦APIが開きます
CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE   本番では無視されますが、そもそも置かない
```

`CUSTOM_CONTEST_ENABLE_BATTLE` が無いことを必ず確認してください。これが `1` だと、PR #30 で閉じた対戦APIが全部開きます。

Fake判定のほうは、`VERCEL_ENV=production` のとき値に関わらず無効になります（PR #30）。それでも置かないでください。

デプロイ後、外から確認できます。

```bash
curl -s https://<本番ドメイン>/api/health
```

`"fakeEvidenceEnabled": false` であること。

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<本番ドメイン>/api/rooms
```

`404` であること。

---

## H. バックアップの置き場所を決める

Neonのinstant restoreは**6時間分しかありません**（ADR-0010）。昨日の状態には戻せません。誤って消したデータを取り戻す手段が、いまはありません。

決めることは2つです。

1. **どこへ置くか** — ローカルのMac、外付け、クラウドストレージのいずれか。中身は利用者のメールアドレスを含むので、公開される場所には置かないでください。
2. **どのくらいの頻度か** — ベータ中は日次で十分です。

手元から取る場合のコマンドです。

```bash
pg_dump "<オーナーロールの接続文字列>" -Fc -f "custom-contest-$(date +%Y%m%d).dump"
```

復元のリハーサルは、**本番ではなく空のNeon branchへ**行います。これをやるまで「バックアップがある」とは言えません。

```bash
pg_restore -d "<復元先の接続文字列>" --clean --if-exists "custom-contest-YYYYMMDD.dump"
```

自動化が必要なら、手順が決まったあとでAgentがスクリプトとスケジュールを用意します。

---

## I. 費用と使用量のアラート

無料枠の壊れ方が2つあります。どちらも黙って止まるので、気づける状態にしておきます。

- **Neon: 月100 CU-hours** — 使い切るとcomputeが翌月まで停止します（データは消えません）。24時間誰かが使い続ける状態だと17日目あたりで到達します。
- **Vercel Hobby: 月100 GB転送 / 100万function実行** — こちらも上限があります。加えてHobbyは**非商用限定**です。

やること:

1. Neonのコンソール → プロジェクトの Settings → Usage alerts を設定（50%、80%）
2. Vercel → Settings → Usage → Notifications を有効化
3. 通知先のメールアドレスを、普段見るものにする

---

## 完了チェックリスト

- [ ] A-1 #31 の扱いを決めた
- [ ] A-2 レート制限の方式を決めた
- [ ] A-3 setIdの扱いを決めた
- [ ] B main rulesetに pull_request と required_status_checks が入った
- [ ] B-2 Dependabot alerts と security updates が有効
- [ ] C `vercel env ls` が手元で通る
- [ ] D `DATABASE_URL` が Production と Preview で別々
- [ ] E-1 `app_runtime` で `CREATE TABLE` が permission denied になる
- [ ] E-2 `MIGRATION_DATABASE_URL` が Production にある
- [ ] E-4 （E-3のmerge後）`DATABASE_URL` が実行時ロールに切り替わり、デプロイが通る
- [ ] F 本番ドメインでGitHub / Googleのログインが往復する
- [ ] G `CUSTOM_CONTEST_ENABLE_BATTLE` が Production に無い
- [ ] G `/api/health` が `fakeEvidenceEnabled: false`
- [ ] G `POST /api/rooms` が 404
- [ ] H バックアップの置き場所と頻度を決め、空branchへの復元を1回通した
- [ ] I NeonとVercelの使用量アラートが届く状態

---

## この間にAgent側で進めること

Userの作業を待たずに進められるものです。

1. `main` に入った新機能の攻撃者視点レビュー（外部問題リンク、freeformタグ、landing page、`practice-schema` の変更）。公開APIが2本増えているため、既存のレビューは対象外になっています。
2. routeレベルの認可テスト。匿名 / ユーザーA / ユーザーB の表を、HTTP経由で全部埋める。
3. CIで実PostgreSQLを起動し、2と既存の統合テストを必須にする。
4. `pnpm audit --prod` をCIへ追加する。
5. `/api/problem-sets` のカーソルページングと、`sort=popular` のインデックス化。

A-2 とA-3 の判断が返ってきた時点で、レート制限とsetIdの作業に着手します。
