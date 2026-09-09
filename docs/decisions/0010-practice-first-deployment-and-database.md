# ADR-0010: 精進側の先行公開と、無料で維持できるデータベース

- Status: Accepted（公開先とDBを2026-09-09に確定。DBなしで先に公開するかどうかは未決）
- Date: 2026-09-08
- Owners: User / Claude Code

## Context

公開の順番が変わった。先に精進側（Discover・問題セット作成・マイページ）を公開し、AC Duel（対戦）はそのあとで仕上げる。

この順番はADR-0009の前提を崩す。ADR-0009がVercelを退けた理由は、Room stateが`apps/web/src/server/rooms/store.ts`のprocess内Mapにあり、serverlessでは複数instanceへ分かれて消えるからだった。しかし**精進側はこの制約を持たない**。

- 問題セットはブラウザーのlocalStorageにある（`apps/web/src/app/_practice/data/repository.ts`）。
- 唯一のserver処理は`GET /api/problems/search`で、固定JSONのカタログを読むだけ。process内に状態を持たず、外部APIも叩かない。

つまり精進側だけなら、今のコードはそのままserverlessで動く。DBが要るのは、localStorageをやめて「どの端末からでも自分のセットが開ける」状態にするとき、つまり認証（ADR-0009）を有効にするときである。

加えて、ADR-0009が挙げたホスティングの無料枠は2026年9月時点で成立しなくなっている。

- **Fly.io**: 2024年10月以降、新規アカウントに無料枠はない。試用は2 VM時間または7日間で終わり、そのあとは従量課金になる。常時起動の最小構成でおよそ月2〜5ドル。
- **Render**: 無料のPostgreSQLは**作成から30日で期限切れ**になり、14日の猶予のあとデータごと削除される。無料のWeb Serviceも15分の無操作で停止し、復帰に30〜60秒かかる。

「完全無料を維持できること」を最優先にする以上、この2つはこのまま採用できない。

## Decision drivers

数値で確かめられるものだけを軸にする。

1. **無料のまま維持できる。** クレジットカードの登録や、期限切れによる有料化を前提にしない。
2. **放置してもデータが消えない。** 一定期間使わないとDBごと削除される、または手作業の復旧が要るサービスを避ける。
3. **今のコードが動く。** 精進側をそのまま載せられ、Room stateの設計（ADR-0003）を書き直さない。
4. **将来AC Duelを載せられる。** 載せられなくてもよいが、そのときに何を足すのかが分かっている。
5. **乗り換えられる。** 特定サービス専用のAPIへ依存しない。

## Options

### ホスティング

#### Option A: Vercel Hobby（精進側のみ）

- Next.jsをそのまま載せられる。精進側はprocess内に状態を持たないので、変更は要らない。
- 無料。Hobbyは月100 GBのFast Data Transfer、100万Edge Requests、100万回のfunction実行、4 CPU時間、6,000ビルド分。
- **Hobbyは非商用に限る。** 個人の趣味プロジェクトである限りは条件を満たすが、収益化した時点で有料プランへ移る必要がある。
- 対戦側は載らない。Room stateを外部storeへ移すまで、AC Duelはここへ置けない。

#### Option B: Cloudflare Workers / Pages

- 無料枠は寛容で、期限切れによる削除がない。
- Next.jsをそのまま載せるにはOpenNextなどのadapterが要り、Node.js runtimeを前提にした箇所（`export const runtime = "nodejs"`）を見直すことになる。
- DBをD1にすると、Drizzleは使えるがPostgreSQLではなくSQLiteになる。ADR-0005のmigrationとauth schemaを書き直すことになる。

#### Option C: Render / Fly.io（ADR-0009の想定）

- 常駐processなので対戦側もそのまま動く。ADR-0009はこれを選んでいた。
- 2026年9月時点で、判断軸1と2をどちらも満たさない。Fly.ioに無料枠はなく、Renderの無料DBは30日で期限切れになる。

### データベース

#### Option D: Neon（PostgreSQL）

- 無料プランは1プロジェクトあたり0.5 GB、プロジェクト100個、月100 CU時間。5分の無操作でcomputeがゼロまで落ちる（無効化できない）。
- **無操作を理由にプロジェクトを削除する規定は文書にない。** 落ちるのはcomputeであって、データではない。
- 復旧はinstant restoreが6時間ぶん（変更履歴1 GBまで）、手動スナップショットが1つ。長期のバックアップは自分で`pg_dump`する必要がある。
- PostgreSQLなので、ADR-0005のDrizzle + `pg`と、ADR-0009のDrizzleAdapterがそのまま使える。
- scale to zeroからの復帰があるため、最初のqueryは数百ミリ秒遅れる。

#### Option E: Supabase（PostgreSQL）

- 認証・ストレージまで揃っていて、単体では最も手数が少ない。
- **無料プロジェクトは約1週間の無操作で一時停止する。** 停止してもデータは残るが、再開は手作業になる。停止から約90日を過ぎるとワンクリック復旧ができなくなり、最終的にはプロジェクトごと消える。
- 判断軸2に正面から反する。友人が数週間開かない、という使われ方をこのプロジェクトは想定している。

#### Option F: Cloudflare D1（SQLite）

- 無料枠は1日500万行読み取り、10万行書き込み、5 GB。2026年9月1日から、上限を超えたqueryは成功せずエラーを返すようになった。
- 期限切れも一時停止もない。
- PostgreSQLではないので、ADR-0005とADR-0009のschemaを書き直すことになる。

#### Option G: DBを持たない（現状維持）

- 精進側はlocalStorageのままで公開する。サーバーに個人データを置かない。
- 端末を変えるとセットが見えない。作成者名といいね数は暫定値のまま。認証も意味を持たない。
- ただし**公開そのものは今日できる**。DBの判断を待つ必要がない。

## Decision

**公開先はVercel、DBはNeonにする（Option A + Option D）。** 2026-09-09に確定した。

比較の最後に残ったのはVercel + NeonとVercel + Supabaseの2つで、次の3点で決めた。

**1. Supabaseの利点はこのプロジェクトでは働かない。** Supabaseの中心はAuth・Storage・Realtime・RLSである。認証はAuth.jsで実装済みで（ADR-0009）、それを残すと決めた。画像のアップロードは予定がない。Realtimeは精進側に要らず、対戦側はRoom stateがprocess内にある以上どのみち書き直しになる。SupabaseをただのPostgresとして使うなら、選ぶ理由が残らない。

**2. 使われ方が読めない。** 一般公開する以上、まったく使われない期間もありうる。Supabaseの無料プロジェクトは1週間APIリクエストがないと停止し、手動で再開するまで動かない（2026-02-01に明文化）。公開直後に黙って止まっているのが最も避けたい壊れ方である。Neonは5分でcomputeが落ちるだけで、次のqueryで自動的に戻る。

**3. Vercelとの結びつきが強い。** VercelはVercel Postgresを2024-12にNeonへ移し、現在Neonを推奨DBとしている。Neonのserverless driverはHTTPで通信するため、serverlessでconnection poolingの設定が要らない。Supabaseはserverlessから使うとき、pooled connection stringのtransaction modeを明示的に選ぶ必要がある。おまけとしてNeonのbranchingがVercelのpreview deployと結びつく。

### 無料枠の天井は容量ではなく compute 時間

Neon無料プランは1プロジェクトあたり月100 CU-hoursで、0.25 CUなら約400時間ぶんにあたる。1か月は約730時間なので、**24時間ずっと誰かが使う状態になると17日目あたりでcomputeが停止し、翌月まで戻らない**（データは消えない）。

つまりNeonとSupabaseは正反対の壊れ方をする。使われなければSupabaseが止まり、使われすぎるとNeonが止まる。後者を選ぶのは、それが「人気が出た」という良い問題であり、その時点で従量課金へ移れば済むからである。Supabase Proの月$25という段差はない。

この規模ではVercel Hobbyの上限（月100 GB転送、100万function実行）も同時に効いてくる。DBだけの問題ではなくなる。

### 検索をDBに当てない

問題検索は入力のたびに走る、このアプリで最も回数の多い処理である。これをPostgreSQLに当てると、誰かが問題を探しているあいだcomputeが起きたままになり、CU-hoursを最も食う経路になる。

カタログはdeployのあいだ変わらない固定データなので、検索は今と同じくメモリ上のJSONを引く。`problems` tableは外部キーの参照先と、セット表示時のJOINのために持つ。詳細はADR-0011にある。

### まだ決めていないこと

DBと認証を入れる前に、localStorageのままの版を先に公開するかどうかは決めていない。上のOption Gはその選択肢として残す。

### AC Duelを公開する段でホスティングを選び直す

Room stateがprocess内にある限り、対戦側はVercelに載らない。そのときの選択肢は2つで、どちらも別ADRとする。

- Room stateをNeon（またはRedis）へ移し、Vercelに寄せる。1秒ごとのpollingがDBを叩く形になるので、pollingの間隔か方式を見直すことになる。
- 常駐processのhostへ月数ドル払う。「完全無料」を諦める代わりに、ADR-0003の設計をそのまま使える。

## Consequences

- ADR-0009の「Fly.io（またはRender）+ Neon」という公開先の記述は、Fly.ioに無料枠がなくなった時点で古い。DBのNeonは残り、hostの部分だけが変わる。このADRが確定したら0009へ追記する。
- 精進側を先に公開するあいだ、`/signin`はOAuth未設定のまま「未設定」と表示され続ける。認証が要るのは手順2からになる。
- Vercel Hobbyは非商用限定である。無料で公開するだけなら条件を満たすが、広告や課金を入れた時点で有料プランへ移る。
- Neonの月100 CU-hoursを使い切るとcomputeが翌月まで停止する。usage画面を見る運用が要る。
- 手順1で公開したあと手順2でDBへ移すとき、利用者のlocalStorageにあるセットは自動ではアカウントへ紐づかない。移行の導線（「この端末のセットをアカウントへ取り込む」）を別途用意することになる。ADR-0009にも同じ課題が書かれている。
- Neonのscale to zeroは無効にできない。5分空いたあとの最初のqueryが遅れることを、画面の読み込み表示で吸収する必要がある。
- Neonのinstant restoreは6時間ぶんしかない。誤って消したデータを翌日に戻すことはできないので、定期的な`pg_dump`を運用に入れる。

## Verification

- Vercelへ配備した`/discover`、`/sets/new`、`/library`が、ローカルと同じ内容を返す。
- `GET /api/problems/search?q=EDPC`が配備先で200を返し、件数がローカルと一致する。
- 配備先で問題セットを作成し、別の端末から同じURLを開くと**見えない**（localStorage段階の想定どおりの挙動であることの確認）。
- Vercelのusage画面で、1週間運用したあとのFunction実行回数とData Transferが無料枠の10%を超えない。
- 手順2に進むとき: Neonの空DBへ`0001`と`0002_auth`のmigrationを適用でき、再実行してもschemaが壊れない。
- 手順2に進むとき: 5分以上放置したあとの初回アクセスが、エラーにならず読み込み表示のあとで完了する。

## Revisit triggers

- Vercel Hobbyの非商用条項に触れる使い方をする。
- Neonの0.5 GBまたは月100 CU時間に近づく。
- AC Duelを公開する。
- Neon、Vercelのいずれかが無料枠の条件を変える。
- 月100 CU-hoursの消費が月の半ばで50%を超える。有料プランへ移す合図になる。
- 利用者が「別の端末から自分のセットを開きたい」と実際に言う。手順2を始める合図になる。

## Evidence

- `apps/web/src/app/_practice/data/repository.ts`（問題セットはlocalStorage）
- `apps/web/src/app/api/problems/search/route.ts`（固定カタログを読むだけで、process内に状態を持たない）
- `apps/web/src/server/rooms/store.ts`（対戦側のRoom stateはprocess内のMap）
- `docs/decisions/0005-database-access.md`、`docs/decisions/0007-problem-set-frontend-boundary.md`、`docs/decisions/0009-deployment-and-auth.md`
- Neon Free planの制限: <https://neon.com/faqs/free-plan-limits-and-quotas>
- Vercel Hobby plan: <https://vercel.com/docs/plans/hobby>
- Supabaseの一時停止: <https://supabase.com/docs/guides/platform/free-project-pausing>
- Cloudflare D1の料金と上限: <https://developers.cloudflare.com/d1/platform/pricing/>
- Fly.ioの廃止済みプラン: <https://fly.io/docs/about/discontinued-plans/>
- Renderの無料枠（無料DBは30日で期限切れ）: <https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026>
- Neonのプラン別制限（Free = 100 CU-hours/月、0.5 GB、5分でscale to zero）: <https://neon.com/docs/introduction/plans>
