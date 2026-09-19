# 濫用への備え（Vercel WAFで塞げた範囲と、塞げなかった範囲）

A-2で「Vercel WAFのrate limitでやる」と決めましたが、**Hobbyプランではrate limitが使えませんでした**。この文書は、実際に何が入って何が入らなかったか、そのぶんを何で埋めたかを残します。

対象は精進側の公開だけです。AC Duelは別判定なので、対戦系の経路はここでは「閉じたまま安く捨てる」ためだけに扱います。

関連: `docs/ops/release-prep-runbook.md`、ADR-0010、ADR-0011。

## 何が起きたか

`Deny`のルールは通りました。`rate_limit`のルールは、超過時の動作が`log`であっても拒否されます。

```
$ vercel firewall rules add --json '{ ... "action": { "mitigate": { "action": "rate_limit", ... } } }'
Error: Rate limiting is not available for this plan (401)
```

`vercel firewall status`にも出ています。

```
  Firewall        Enabled
  Bypass          Requires Pro or Enterprise
  Mitigations     Active
  Attack Mode     Off
  Bot Protection  Off
  OWASP           Off  · requires Security+
```

Hobbyで使えるのは、**カスタムルールのDeny**、**自動DDoS緩和（Mitigations）**、**Attack Mode**の3つです。

> **注意。** `writes-30-per-min`という名前のrate limitルールが1本だけ live に残っています。プランが拒否する種類のルールなので、実際に効いているとは限りません。**あると思って設計しないでください。** 消すか、効いているかを実測で確かめるかのどちらかです。

## 経路ごとの重さ

上限や cache の長さを決める根拠です。数値は実測とコードの読み取りによります。

| 経路 | 認証 | 1requestあたりの仕事 |
|---|---|---|
| `GET /api/problem-sets` | 不要 | DB 1 query。1ページ24件（`DISCOVER_PAGE_SIZE`） |
| `GET /api/problems/search` | 不要 | DBを使わない。約4,800問をメモリ上で走査 |
| `GET /api/problem-sets/tags` | 不要 | 公開セット全体をunnest + GROUP BY |
| `GET /api/problem-sets/featured` | 不要 | DB 1 query、4件 |
| `GET /api/problem-sets/[setId]` | 任意 | DB 2 query |
| `GET /api/problem-sets/[setId]/viewer` | 任意 | DB 3 query |
| `GET /api/problems/external` | 不要 | DB 2 query |
| `POST /api/problem-sets/[setId]/like` | 要 | **DB 約6 query** |
| `POST /api/problem-sets/[setId]/bookmark` | 要 | DB 約6 query |
| `POST /api/problem-sets/[setId]/view` | 要 | DB 約3 query。**セットを開くたびに自動で飛ぶ** |
| `PUT /api/problem-sets/[setId]/solve-status` | 要 | DB 約3 query。**1問マークするごとに1本** |
| `PUT` / `DELETE /api/problem-sets/[setId]` | 要 | DB 複数 + transaction |
| `POST /api/problems/external` | 要 | DB 3〜4 query |
| `GET /api/health` | 不要 | DB 2 query |
| `/api/auth/*` | — | OAuth往復。callbackでsessionを書く |

VercelのNeon poolは`max: 1`（`client.ts`）です。1 instanceが同時に流せるqueryは1本なので、**DB往復の多い経路ほど、同じrequest数でも詰まりやすい**ことに注意してください。

## 入っているもの

### 1. 未公開の経路を落とす（Deny・適用済み）

```
Path starts with  /api/rooms
Path starts with  /api/matches
Path starts with  /api/userscript
Path starts with  /api/dev
→ Deny
```

アプリ側は既に404を返します（`feature-gate.ts`、PR #30）。ここで落とす狙いは安全ではなく**費用**です。WAFで捨てればFunctionが動かないので、探りに来たrequestが実行回数を消費しません。

対戦を公開するときはこのルールを外します。外す前にRoom stateの置き場所を決め直すこと（ADR-0010）。

> `/api/dev/fake-evidence`もここで落ちます。Previewでの手動テストで偽の提出証跡を使うなら、このルールに`environment`条件を足して production 限定にしてください。

### 2. 未認証で叩ける読み取りをCDNへ預ける（適用済み）

rate limitの代わりに置いたものです。**同じrequestの連打は、Functionを起動せずにCDNが返します。**

| 経路 | `s-maxage` | 決め方 |
|---|---|---|
| `GET /api/problems/search` | 3600秒 | カタログはdeployのあいだ変わらない |
| `GET /api/problem-sets/tags` | 300秒 | タグの集計は多少古くてよい |
| `GET /api/problem-sets` | 30秒 | 公開した本人が自分のセットを見つけられない時間を延ばさない |
| `GET /api/problem-sets/featured` | 30秒 | 同上 |
| `GET /api/health` | 5秒（成功時のみ） | 失敗を配り続けない |

効果は掛け算で効きます。300 req/分の連打でも、CDNへ届くのは30秒に1本なので、Functionは2回しか動きません。

**預けてよいのは「誰が見ても同じ」応答だけです。** `[setId]`、`viewer`、`library`、`counts`は見る人で内容が変わるので預けません。`response-caching.integration.test.ts`がこの線を固定しています。

### 3. アプリ側の上限（適用済み）

WAFはIPしか見ないので、利用者単位の制限はアプリが持ちます。

- 1人が持てるセット数（`MAX_SETS_PER_USER = 200`）
- 1セットの問題数（`MAX_PROBLEMS_PER_SET = 200`）
- 外部問題の登録は1日20件（`ExternalProblemLimitError`）
- 別サイトからの書き込みを拒否（`requireSameOrigin`、PR #47）

## 塞げていないもの

**認証済みの1人が、1つのIPから書き込みを連打する経路に上限がありません。**

具体的には`like`・`bookmark`・`view`・`solve-status`です。1回あたりDB 3〜6 query、`max: 1`のpoolを通ります。アプリ側の上限は「持てる数」を縛るもので、「速さ」は縛りません。

いま許容できている理由は3つです。

- 招待制ベータで、参加者が誰か分かっている
- 書き込みはログインを要求するので、濫用者は必ず特定できるアカウントに紐づく
- Vercelの自動DDoS緩和（Mitigations: Active）が、桁違いの量には反応する

**一般公開の規模になったら、これは足りません。** 塞ぐ手段は3つあります。

| 手段 | 費用 | 得られるもの |
|---|---|---|
| Vercel Pro | 月20ドル | WAFのrate limit。この文書の元の設計がそのまま入る |
| Upstash Redis（Vercel Marketplace） | 無料枠あり | **利用者単位**の制限。IPではないのでWAFより正確 |
| Postgresで数える | 追加費用なし | 1 requestにつきUPSERT 1本。守る対象が6 queryなら割に合う |

利用者単位で数えたいなら、IPで数えるWAFへ戻るよりUpstashのほうが目的に合います。**Proへ上げるのは、WAFのrate limitだけのためなら急ぎません。**

## 運用で見るもの

Hobbyでも使えるものです。

```bash
vercel firewall overview
```

```bash
vercel firewall traffic list
```

異常な量を見つけたら、break-glassとしてAttack Modeがあります。**全requestに検証ページを出す**ので、通常運転では使いません。

```bash
vercel firewall attack-mode
```

CDNが効いているかは、同じURLを2回叩いて確かめます。

```bash
curl -sI "https://custom-problems.vercel.app/api/problem-sets?sort=popular" | grep -i "x-vercel-cache\|age"
```

2回目が`x-vercel-cache: HIT`になり、`age`が増えていれば預かれています。`MISS`が続くなら、応答に`set-cookie`が乗っているか、`cache-control`が上書きされています。

## 負荷試験との関係

**本番と実AtCoderへは向けないこと**（`docs/ai/working-agreement.md`）。

rate limitが無いので、「上限に当たったとき429が返るか」は試験項目から外れます。代わりに見るのは次の2つです。

- CDNが効いている経路で、連打してもFunction実行回数が増えないこと
- 書き込みを連打したときに、5xxではなく正常に処理され続けるか、どこで詰まるか

後者が、いまいちばん分かっていない数字です。
