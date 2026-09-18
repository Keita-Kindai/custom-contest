# Vercel WAFのレート制限（適用手順）

A-2で決めた方式の実装仕様です。ルールはVercelのダッシュボードで人が入れます。コードは変わりません。

対象は精進側の公開だけです。AC Duelは別判定なので、対戦系の経路はここでは「閉じたまま安く捨てる」ためだけに扱います。

関連: `docs/ops/release-prep-runbook.md`、ADR-0010、ADR-0011。

## なぜWAFなのか

アプリの中で数えると、数えるためにFunctionが動きます。無料枠の天井はFunction実行回数とcompute時間なので、濫用されたときに「止めた分だけ課金される」形になります。WAFはアプリへ届く前に落とすので、止めた分は数えられません。

代わりに、WAFで**できないこと**があります。

- **利用者ごとの上限にできない。** WAFが見分けられるのはIPで、ログインした誰かではありません。共有回線の裏に複数人いれば同じIPになりますし、1人が回線を変えれば別IPになります。
- **アプリの文脈を知らない。** 「このセットの持ち主か」「この人は今日もう20件登録したか」といった判断はできません。

したがって次の2つは引き続きアプリ側が持ちます。WAFはその前段です。

- 1人あたりのセット数（`MAX_SETS_PER_USER`）
- 外部問題の1日20件（`ExternalProblemLimitError`）

## 経路ごとの重さ

上限を決める根拠です。数値は実測とコードの読み取りによります。

| 経路 | 認証 | 1requestあたりの仕事 |
|---|---|---|
| `GET /api/problem-sets` | 不要 | DB 1 query。1ページ24件に制限済み |
| `GET /api/problems/search` | 不要 | DBを使わない。約4,800問をメモリ上で走査 |
| `GET /api/problem-sets/tags` | 不要 | 公開セット全体をunnest + GROUP BY。CDNに5分預ける |
| `GET /api/problem-sets/featured` | 不要 | DB 1 query、4件 |
| `GET /api/problem-sets/[setId]` | 任意 | DB 2 query |
| `GET /api/problem-sets/[setId]/viewer` | 任意 | DB 3 query |
| `GET /api/problems/external` | 不要 | DB 2 query（`count(*)`と本体） |
| `POST /api/problem-sets/[setId]/like` | 要 | **DB 約6 query** |
| `POST /api/problem-sets/[setId]/bookmark` | 要 | DB 約6 query |
| `POST /api/problem-sets/[setId]/view` | 要 | DB 約3 query |
| `PUT` / `DELETE /api/problem-sets/[setId]` | 要 | DB 複数 + transaction |
| `POST /api/problems/external` | 要 | DB 3〜4 query |
| `GET /api/health` | 不要 | DB 2 query |
| `/api/auth/*` | — | OAuth往復。callbackでsessionを書く |

VercelのNeon poolは`max: 1`（`client.ts`）です。1 instanceが同時に流せるqueryは1本なので、**DB往復の多い経路ほど、同じrequest数でも詰まりやすい**ことに注意してください。いいねの連打が効くのはこのためです。

## 入れるルール

上から順に評価されます。先に当たったものが効きます。

### 1. 公開していない経路は落とす（Deny）

```
Path starts with  /api/rooms
Path starts with  /api/matches
Path starts with  /api/userscript
Path starts with  /api/dev
→ Deny
```

アプリ側は既に404を返します（`feature-gate.ts`、PR #30）。ここで落とす狙いは安全ではなく**費用**です。WAFで捨てればFunctionが動かないので、探りに来たrequestが実行回数を消費しません。

対戦を公開するときはこのルールを外します。外す前にRoom stateの置き場所を決め直すこと（ADR-0010）。

### 2. 書き込み（Rate Limit）

```
Path starts with  /api/problem-sets
Method is         POST, PUT, DELETE
→ Rate Limit  30 requests / 60s / IP
```

作成・更新・削除・いいね・保存・最近使用がここに入ります。いちばん重い`like`でも、30 req/分ならDB往復は180/分に収まります。

人の操作としては十分です。画面からこの数を超えるのは、連打かスクリプトのときだけです。

### 3. 外部問題の登録（Rate Limit）

```
Path is     /api/problems/external
Method is   POST
→ Rate Limit  10 requests / 60s / IP
```

アプリ側に1日20件の上限があります。これはその上限へ到達するまでの速度を抑えるためのものです。

### 4. 未認証で読める経路（Rate Limit）

```
Path is  /api/problem-sets
Path is  /api/problems/search
Path is  /api/problems/external   (GET)
Path is  /api/problem-sets/tags
Path is  /api/problem-sets/featured
→ Rate Limit  120 requests / 60s / IP
```

検索は入力のたびに走るので、この中では最も回数が出ます。120/分はdebounceの効いた入力なら当たりません。

`/api/problems/search`はカタログが固定なのでCDNへ預けられます（PR #31）。それが入ればWAFへ届く回数自体が減ります。**#31が未マージのあいだは、この経路が毎回Functionを起動します。**

### 5. 認証の入口（Rate Limit）

```
Path starts with  /api/auth
→ Rate Limit  20 requests / 60s / IP
```

OAuthなので総当たりは効きませんが、callbackはsessionを書きます。往復を繰り返すだけでDBへの書き込みを起こせるので、上限を置きます。

### 6. 監視用（Rate Limit）

```
Path is  /api/health
→ Rate Limit  30 requests / 60s / IP
```

毎回`select 1`とmigration確認の2 queryを出します。PR #31が入れば成功時は5秒CDNに載るので、実際にDBへ届く回数はさらに減ります。

### 7. 全体の網（Rate Limit）

```
Path starts with  /api
→ Rate Limit  300 requests / 60s / IP
```

個別ルールから漏れた経路と、複数経路にまたがる負荷を拾います。

## 確認すること

ダッシュボードで入れる前に。

- **Hobbyプランで使えるルール数と、Rate Limitアクションの可否を確認してください。** ここの7本が上限に収まらない場合は、4と7を残して他を畳んでください。落とす順は、2（書き込み）と1（Deny）を最後まで残す形にします。
- ルールは**Log**または**Challenge**で1日ほど流してから**Deny**へ上げてください。いきなり遮断すると、想定外の正常な使い方を切ります。

入れたあとに。

- Vercelのfirewall画面で、どのルールが何件当てているかを見てください。**正常な利用で当たっているルールがあれば、上限が低すぎます。**
- 429が返ったときに画面が壊れないことを確認してください。現在のclientは`ApiError`としてメッセージを出します。

## これで塞がらないもの

WAFはIPで数えるので、次は別の手段が要ります。

- **ログインした1人が、回線を変えながら行う濫用。** セット数の上限（PR #45）と外部問題の1日20件がこれを受け持ちます。
- **分散した多数のIPからの負荷。** Vercelの自動DDoS緩和と、必要ならAttack Modeです。
- **1requestあたりが重すぎる経路。** 上限を掛ける前に、その経路自体を軽くするほうが効きます。Discoverの一覧がその例でした（PR #44、20,000件で135.6ms → 0.565ms）。

## 隔離環境での負荷試験との関係

負荷試験はこのルールを**入れた状態**で行ってください。上限に当たったときに、5xxではなく429が返り、画面がそれを説明することまで含めて測ります。

試験の数値目標は runbook にあります。上限到達時の挙動は、そこでの「意図した429」として記録します。
