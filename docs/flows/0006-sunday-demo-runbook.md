# 日曜デモ runbook

## 1. ホストPCの準備

Node 24.19.0、pnpm 11.19.0、PostgreSQL 18を使います。PostgreSQLを起動し、デモ用databaseを作成してから`apps/web/.env.local`を用意します。

```sh
nvm use 24.19.0
node --version # v24.19.0
pnpm --version # 11.19.0
brew services start postgresql@18
pg_isready -d postgres
```

`brew services start`が成功表示でも、`brew services list`が`other`かつ`pg_isready`が`no response`の場合は、まずLaunchAgentの実状態を確認します。

```sh
launchctl print "gui/$(id -u)/homebrew.mxcl.postgresql@18"
```

2026-09-04に確認したmacOSの`pending spawn, domain in on-demand-only mode`と同じ状態で、jobがloaded済み・PIDなしの場合は、登録済みjobを明示起動します。

```sh
launchctl kickstart -p "gui/$(id -u)/homebrew.mxcl.postgresql@18"
pg_isready -d postgres
```

原因と安全な切り分けは[`docs/learning/postgresql-local-service.md`](../learning/postgresql-local-service.md)に記録しています。

`custom_contest`がまだ存在しない場合だけ作成します。

```sh
if ! psql -X -d postgres -Atc \
  "select 1 from pg_database where datname='custom_contest'" | rg -qx 1; then
  createdb custom_contest
fi
```

```dotenv
DATABASE_URL=postgresql://localhost:5432/custom_contest
CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE=1
```

```sh
pnpm db:migrate
pnpm check
pnpm dev --hostname 0.0.0.0
```

`pnpm db:migrate`は同じSQLを再実行しても安全な実装です。変更がなくても`applied 0001_match_results`と表示されるため、適用状態の確認は`/api/health`の`database.migrated: true`を使います。

`http://localhost:3000/api/health`が`ok: true`ならRoomを作成できます。LAN上の友人へは、ホストPCのIPを使った`http://<host-ip>:3000`を共有します。

## 2. userscriptのbuildと導入

ホストPCのLAN URLを埋め込んでbuildします。これによりTampermonkeyの`@connect`はそのhostだけに限定されます。

```sh
CUSTOM_CONTEST_SERVER_ORIGIN=http://<host-ip>:3000 pnpm userscript:build
```

両方のChrome/Edgeで、生成された`apps/userscript/dist/custom-contest-atcoder.user.js`をTampermonkeyへ読み込ませ、各自のAtCoderアカウントへログインします。

## 3. 対戦

1. それぞれの端末で開発用プロフィールに本人のAtCoder IDを保存する。
2. HostがRoomを作り、招待URLを友人へ送る。
3. 両者が「AtCoderと接続」を押し、AtCoder上の右下に`AC Duel · Room ... に接続`と出ることを確認する。
4. 両者がREADYになり、Hostが開始する。
5. `3 → 2 → 1 → START`後に表示された同じ問題を開いて提出する。
6. Pending、最終判定、両画面の勝敗、結果URLを確認する。

実提出の確認には`Litms`またはその場で明示的に許可された友人の提出だけを使います。ソースコード本文とコード長は取得しません。

## 4. 復旧手段

- 実判定が取れない場合: AtCoderタブ右下の接続表示、ログインID、Room側の修正案を確認する。
- userscriptが不安定な場合: Roomの「AtCoderと接続」をもう一度実行する。古いtokenは無効になる。
- デモ進行を優先する場合: Match画面の折りたたみ「デモ操作」から、各本人が自分のFake判定を送る。
- Web通信が一時切断した場合: 操作せず再接続を待つ。サーバー時計とMatchは停止しない。

## 5. 実地確認の状態

2026-09-04に2台のPCのTampermonkeyへuserscript `0.1.0-demo`を導入し、別々のAtCoder accountでRoom接続から実提出、判定取得、勝敗確定まで問題なく完走した。ログインID取得、提出一覧DOM、status JSONはこの実地確認時点で機能している。

その後、AtCoder accessの重複排除、接続通知の4秒自動非表示、LOSEの赤表示、STARTの0.8秒保持を入れた。さらに`0.1.2-demo`では同じpoll周期内の追加status JSON取得をやめ、AtCoderへの最大頻度をactive Match中5秒に1回へ制限した。自動testは通過済みだが、両PCのTampermonkeyを0.1.2へ更新した後、接続と実提出を1回だけ再確認する。

デモは過去問だけを使い、開催中の公式ABC・ARC・AGCとは同時に行わない。AtCoderは各参加者が本人のaccountを使い、1人が予備accountを作ったり、accountを貸し借りしたりしない。外部サービスの利用境界と再確認条件は`docs/security/external-service-usage.md`を参照する。
