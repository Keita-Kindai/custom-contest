# 2026-09-05 引き継ぎ: 精進UX round 2 / BO3設計 / 認証

対象: 2026-09-06のデモを行う人、およびこの続きを実装する人。

前提: `feat/problem-set-frontend`を土台に、3本のbranchへ分けてある。どれも`main`へmergeしていない。

---

## 1. 明日のデモで実際にやること

### 1-1. どのbranchで動かすか

`feat/practice-ux-round2`。対戦のE2E（`apps/web/e2e/bo1-demo.spec.ts`）が通ることを確認済みなので、対戦と精進の両方をこのbranchから見せられる。

```sh
git switch feat/practice-ux-round2
nvm use 24.19.0   # 現在の既定は v22.12.0。engines は 24.19.0 を要求する
```

### 1-2. 同じ家・同じLANでやる場合

`docs/flows/0006-sunday-demo-runbook.md`の手順そのまま。1-bの節は読み飛ばしてよい。

### 1-3. 友人が遠隔の場合

runbookに**1-b「遠隔デモにする場合（Cloudflare Tunnel）」**を追加した。順序が重要なので、その順で実行すること。

1. PostgreSQLを起動し、`pnpm db:migrate`、`pnpm dev --hostname 0.0.0.0`
2. `brew install cloudflared`（未導入。これだけは人が実行する）
3. `cloudflared tunnel --url http://localhost:3000` → `https://<ランダム>.trycloudflare.com`が出る
4. **そのURLを使って**userscriptをbuild: `CUSTOM_CONTEST_SERVER_ORIGIN=https://<ランダム>.trycloudflare.com pnpm userscript:build`
5. 両者のTampermonkeyへ入れ直す

tunnelを止めるとURLが変わる。変わったら4と5をやり直す。デモが終わったらtunnelを止める。

**Vercelは使わない。** `RoomStore`はNext.js processのメモリ上のMapで、対戦画面は1秒ごとにそれを読む。serverlessではprocessが複数instanceへ分かれるので、部屋が消えたり相手が見えなかったりする。理由はADR-0009に書いた。

### 1-4. デモの形式

BO1のまま。BO3は設計だけで、実装していない。

---

## 2. やったこと

### branch `feat/practice-ux-round2`（画面の改善 + デモ手順）

- **問題名がAtCoderへのリンクになった。** 各行の「AtCoderで開く」ボタンは廃止。セット詳細、作成画面の検索結果、追加済み一覧の3か所すべて。セット一覧のカードのタイトルは今までどおりセット詳細へ行く（問題名とセット名で行き先が違う）
- **挑戦状態（Solve status）を追加。** 未AC / 自力AC / 解説AC の3値。セット詳細の行で押すたびに切り替わる。行の左罫と薄い背景色が変わり、状態名は必ず文字でも出る
  - `problemId`単位なので、同じ問題を別のセットに入れても状態は1つ
  - 作成画面の検索結果と追加済み一覧には、押せない表示だけを出す。「これもう解いたやつだ」が作成中に分かる
  - localStorage保存。**この端末にしか残らない**。認証が入ったらDBへ移す
- **Discoverの検索結果をカードにした。** 表形式をやめ、検索前の特集と同じ見た目に揃えた。`SetRow`と表headerのCSSは消していないが、今は使っていない
- **対戦側から精進側への導線。** トップの`Roomを作る / IDで参加`の隣と、`/battle/new`の下に「問題セットを探す」を置いた。出題を問題セットから行う機能結合はしていない（別Issue）
- runbookへ遠隔デモの節、`docs/design/open-questions.md`へDESIGN-083〜088

`pnpm check`通過。対戦E2E通過。screenshotは`docs/ai/handoffs/screenshots/2026-09-05-*.png`。

### branch `feat/bo3`（設計のみ、コード変更なし）

BO3を書き始める前に、用語とコードが食い違っていることが分かった。

`CONTEXT.md`は「BO3のMatchは最大3 Roundからなる」と書いていたが、コードでは1 Match = 1問 = 1結果で、`match_results`のprimary keyは`matchId`、結果URLも`/battle/m/[matchId]`。再戦は新しいMatchを作る。つまり「3 Roundを含むMatch」はどこにも無い。

**ADR-0008**でコード側を正とした。Seriesが最大3 Matchを含む。Roundは「Seriesの何試合目か」を指す位置で、1 Roundは1 Matchとして実現する。`CONTEXT.md`も直した。

決めたルール:

- 2勝でSeries終了
- DRAWはラウンドを消化するが勝ちにはならない
- VOIDはラウンドを消化しない。同じラウンド番号を別問題で引き直す
- Forfeitは、そのラウンドではなくSeries全体を相手の勝ちにする
- 3ラウンド消化して誰も2勝していなければSeries自体が引き分け
- 出題済み除外はSeries全体にまたがる（現状の実装のまま）
- 片方が退出したらSeries中断、勝者を記録しない
- ラウンドの進行は両者の承認。既存の再戦の経路を流用し、表示だけ「次のラウンドへ」に変える

実装前に必要な変更が2つ見つかっている。`RoomSettings.mode`が`z.literal("BO1")`であること、`0001_match_results.sql`に`CHECK (mode = 'BO1')`があること。どちらもADRに書いた。

### branch `feat/auth`（**あなたの操作が要る**）

**ADR-0009**で公開先と認証を決め、そこまで実装した。

- 公開先: 常駐processのhost（Fly.io / Render）+ Neon Postgres。Vercelは採らない（1-3の理由）
- 認証: Auth.js（next-auth v5）でGitHubとGoogleのOAuthだけ。**パスワードは1つも保存しない**。sessionはDBに置くのでサーバー側から失効させられる
- AtCoder IDは`users.atcoder_id`に自己申告として保存するだけ。ログインにも本人確認にも使わない

書いたもの: `users` / `accounts` / `sessions` / `verification_tokens`の4 table、migration `0002_auth`、`apps/web/src/auth.ts`、`/api/auth/[...nextauth]`、`/signin`画面、`.env.example`の項目、dependency inventoryへの記録。

環境変数が空でも`pnpm check`が通り、`/signin`は「未設定」と表示する。`pnpm audit --prod`は0件。

**あなたがやること（5〜10分）:**

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。callback URLは`http://localhost:3000/api/auth/callback/github`
2. Google Cloud Console → Credentials → OAuth client ID（Web application）。redirect URIは`http://localhost:3000/api/auth/callback/google`
3. `openssl rand -base64 32` で`AUTH_SECRET`を作る
4. `apps/web/.env.local`へ5つ書く: `AUTH_SECRET` `AUTH_GITHUB_ID` `AUTH_GITHUB_SECRET` `AUTH_GOOGLE_ID` `AUTH_GOOGLE_SECRET`
5. `pnpm db:migrate`
6. `/signin`にボタンが2つ出る

`next-auth@5.0.0-beta.32`はbeta。App Router + React 19に対応した安定版がまだ無いため。inventoryに例外として記録済み。

---

## 3. やっていないこと

- **作成画面のレイアウト。** 「検索の下に追加済み一覧がある」問題。あなたが後回しでよいと言ったのでそのまま。`2026-09-05-set-editor.png`を見ると分かるが、検索結果20件の下にあるので追加済みが画面外にある。案は「左=検索 / 右=追加済み + 状態サマリ（sticky）」の2カラム化
- **長押しでの並び替え。** 上と同じ理由で未着手。↑↓ボタンは動く。実装する場合は自前のHTML5 drag and drop + pointer eventsで、新規依存なしでできる
- **BO3の実装。** 設計のみ
- **対戦の出題を問題セットから行う機能。** 導線リンクだけ置いた
- **localStorageのセットをアカウントへ移す処理。** DESIGN-090として未決のまま

---

## 4. 未決事項

`docs/design/open-questions.md`のOpen行。特に新しいもの:

- DESIGN-090: localStorageの問題セットをログイン後のアカウントへどう引き継ぐか
- DESIGN-091: Room作成と対戦参加にログインを必須にするか（現状は必須にしていない）

---

## 5. 注意

- Nodeの既定が`v22.12.0`で、`engines`は`24.19.0`を要求している。全コマンドが`Unsupported engine`警告を出すが動く。デモ前に`nvm use 24.19.0`しておくと警告が消える
- `feat/bo3`と`feat/auth`は`feat/problem-set-frontend`を土台にrebase済み。`feat/practice-ux-round2`とは独立していて、docsの衝突はない
