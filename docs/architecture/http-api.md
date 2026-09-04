# BO1 MVP HTTP API

すべてNext.js Node process内のRoute Handlerです。Room snapshotのGETはcacheせず、ブラウザーが1秒ごとに全体を取得します。

通常の画面APIでは、参加者キーをPOST bodyの`participantKey`へ入れます。GET snapshotだけはbodyを持てないため、`x-custom-contest-participant-key` headerを使います。参加者キーはRoom IDとは別の推測困難な値で、ブラウザーのlocalStorageだけに保存します。

| Method | Path | 用途 |
| --- | --- | --- |
| POST | `/api/rooms` | Room作成。DB/migrationが利用不能なら作成しない |
| POST | `/api/rooms/[roomId]/join` | Invitee参加または既存キーで席へ復帰 |
| GET | `/api/rooms/[roomId]` | 本人向けRoom snapshot全体 |
| POST | `/api/rooms/[roomId]/ready` | 本人のREADY変更 |
| POST | `/api/rooms/[roomId]/start` | Hostによる開始要求 |
| POST | `/api/rooms/[roomId]/cancel-start` | Countdownを中止して両者READY解除 |
| POST | `/api/rooms/[roomId]/forfeit` | 明示的な棄権 |
| POST | `/api/rooms/[roomId]/problem-unavailable` | 問題を開けない報告。START前は再抽選、START後は原因付きVOID |
| POST | `/api/rooms/[roomId]/rematch` | 再戦の申込・承認・取消 |
| POST | `/api/rooms/[roomId]/leave` | 退出・Room終了・Invitee席解放 |
| POST | `/api/rooms/[roomId]/link-key` | userscript用の一回限り接続キー発行 |
| POST | `/api/dev/fake-evidence` | LAN demo/test限定の本人Fake提出 |
| POST | `/api/userscript/link` | 接続キーをRoom/Participant限定tokenへ交換 |
| POST | `/api/userscript/heartbeat` | login ID・判定先の健全性とactive Matchを同期 |
| POST | `/api/userscript/evidence` | Pendingまたは最終判定の通知とACK |
| GET | `/api/matches/[matchId]` | 限定公開の完了Match結果 |
| GET | `/api/health` | DB、migration、問題pool、Fake受付の状態 |

request/response/errorのruntime schemaは`packages/contracts`を正本とします。userscriptの3 endpointだけはAtCoder origin向けCORS headerを返しますが、実際の認可は一回限りの接続キーと専用tokenで行います。

PostgreSQLへ初めて接続した時と、その後24時間以上経過した最初のDB access時に、`expires_at`を過ぎたMatchを削除します。結果取得時にも同じcleanupを通るため、期限切れの結果URLから提出履歴が再表示されることはありません。

## snapshotの状態遷移

`snapshot.view`はRoomの表示状態、`snapshot.match.phase`はMatchの進行段階です。Matchがない待機中は`view: "waiting"`で`match: null`になります。

状態を変えるのはサーバーだけです。ブラウザーは意図を送り、返ってきたsnapshotを描画します。時間経過による遷移は、snapshot取得と各API呼び出しの先頭で毎回評価されます（`snapshotFor()` → `tick()`）。専用のtimerは動いていないため、pollingが止まっている間は状態も進みません。

| From | To | 契機 | 補足 |
| --- | --- | --- | --- |
| `waiting` | `countdown` | `POST /start` | Hostのみ。両者READYとuserscript healthをサーバーが再検査する |
| `countdown` | `waiting` | `POST /cancel-start` | どちらも実行できる。両者のREADYを解除し、Matchを破棄する |
| `countdown` | `live` | 時間経過（`now >= startsAt`） | START。ここで初めて`match.problem`がnullでなくなる |
| `live` | `decided` | 有効ACをサーバーが最初に受理 | `reason: "first_ac"`。後着ACでは変わらない |
| `live` | `decided` | `POST /forfeit` | `reason: "forfeit"`、`winnerSeat`は相手 |
| `live` | `decided` | `POST /problem-unavailable` | `outcome: "void"`、`reason: "void_problem_unavailable"` |
| `live` | `awaiting_judge` | 時間切れ＋時間内Pendingあり | `graceUntil = deadlineAt + 5分` |
| `live` | `decided` | 時間切れ＋Pendingなし | `outcome: "draw"`、`reason: "timeout_no_pending"` |
| `awaiting_judge` | `decided` | 有効ACが届く | `reason: "first_ac"` |
| `awaiting_judge` | `decided` | Pendingが全て非ACで確定 | `outcome: "draw"`、`reason: "timeout_all_non_ac"` |
| `awaiting_judge` | `decided` | `now >= graceUntil` | `outcome: "void"`、`reason: "void_judge_unconfirmed"` |
| `decided` | `waiting` | `POST /rematch` の`accept` | `match.persistence === "saved"` が前提。過去Matchの結果URLは変わらない |
| いずれか | `closed` | `POST /leave` の`close_room` | Hostのみ。`closedReason: "host_closed"` |
| 非対戦中 | `closed` | 両者無接続のまま30分 | `closedReason: "idle_timeout"` |

`match.persistence`は`not_required` → 結果確定で`pending` → 保存成功で`saved`と進みます。`pending`の間は`rematch.available`がfalseになり、`persistenceMessage`に「結果を保存中です」が入ります。

`canReady` / `canStart` / `rematch.available` は、対応する`readyBlockedReason` / `startBlockedReason` / `rematch.blockedReason` と対になっています。ボタンのdisabled判定はこのbooleanを使い、理由の文言はそのまま画面へ出せる日本語です。UI側で条件を再計算しないでください。

## 参加者キーの扱い

参加者キーはブラウザーのlocalStorageだけに置きます（`ac-duel:participant:{ROOM_ID}`）。Room IDとは独立した推測困難な値で、URLにもRoom snapshotにも他の参加者の画面にも出しません。

Room画面を開いたときの流れは次のとおりです。

1. localStorageにキーがあれば、それをそのまま使って`GET /api/rooms/[roomId]`から再開する。
2. なければ`POST /api/rooms/[roomId]/join`で席を取り、返ってきたキーを保存する。
3. `POST /join`は既存キーを渡して再送しても同じ席へ復帰する。ページ再読み込みと通信復旧はこの経路で戻る。

Inviteeの退出、Hostによる席の解放、Roomの終了では、対象の参加者キーとuserscript専用tokenが無効になります。無効なキーでのアクセスは`not_a_participant`を返します。

## pollingと再接続

```
poll():
  try:
    snapshot = GET /api/rooms/{roomId}   # header: x-custom-contest-participant-key
    apply(snapshot)                       # lastSuccess = now、reconnecting = false
  catch:
    if 一度も成功していない: 致命的エラーを表示
    else if now - lastSuccess >= 3000ms: reconnecting = true
  finally:
    setTimeout(poll, 1000)                # 失敗しても止めない
```

- 1回の失敗では警告を出さず、次の1秒後に再試行します。
- 3秒以上取得できなければ`reconnecting`を立て、共有状態を変える操作（`mutate()`）を無効にします。タイマー表示は止めません。
- 復旧時は差分ではなく最新のsnapshot全体で置き換えます。
- タイマーはクライアントの時計を加算せず、`snapshot.serverTime`と自分の時刻の差を`serverOffset`として保持し、サーバー基準で描画します。

操作系は同じsnapshotを返すため、応答をそのまま`apply()`へ渡せます。

```
mutate(path, body):
  if reconnecting: 何もしない
  snapshot = POST /api/rooms/{roomId}/{path}  { participantKey, ...body }
  apply(snapshot)
```

`apply()`は`snapshot.revision`が現在値より小さい応答を捨てます。pollingとmutateは並行して走るため、この比較がないと、遅れて届いたpolling応答が新しいsnapshotを1 revision分だけ巻き戻します。ADR-0002とADR-0003が検証項目に挙げている「古い応答が新しい状態を上書きしない」はこの比較で満たしています。

`revision`はRoom単位で単調増加し、再戦やMatch破棄でも戻りません。捨てるのは描画に使う状態だけで、取得が成功した事実（再接続表示の解除）は古いsnapshotでも反映します。
