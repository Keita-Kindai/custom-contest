# Custom Contest context

問題セットを探す、練習する、友達と対戦する、良いセットを共有する、という循環を作るためのドメイン用語を定義します。

## Language

**Problem set（問題セット）**:
条件生成または手動編集した、順序を持つ問題のまとまり。

**Contest mode**:
制限時間内に複数の問題を解き、成績によって順位を競う対戦方式。

**Battle mode**:
問題を1問ずつ競い、先にACした参加者がラウンドを取る対戦方式。

**Room**:
2人の参加者が集まり、対戦条件と準備状態を共有する場所。再戦しても同じRoomを使え、Room自体は勝敗結果を表さない。

**Invite-only Room（招待制Room）**:
公開一覧や自動マッチングからは参加できず、招待URLまたはRoom IDを知る人だけが参加できるRoom。参加者同士が知人であることや、不正を行わないことまでは保証しない。

**Matchmaking（マッチメイキング）**:
参加者が相手へ招待URLやRoom IDを直接共有しなくても、条件に応じて対戦相手を探して組み合わせる機能。Invite-only Roomによる対戦とは区別し、初期段階では扱わない。

**Match（対戦）**:
Room内で開始し、勝ち、負け、引き分け、または無効のいずれかが確定するまでの1回の競技。
_Avoid_: Game, Battle（単体の結果を指す意味では使わない）

**Round（ラウンド）**:
Battle modeで、1問の勝者を決める単位。BO1のMatchは1 Round、BO3のMatchは最大3 Roundからなる。

**Participant（参加者）**:
Roomの2つの席のいずれかを持つ人。HostとInviteeの総称。
_Avoid_: Player, Member

**Host（ホスト）**:
Roomを作成した参加者。

**Invitee（招待参加者）**:
Room IDまたは招待リンクからRoomに入った参加者。
_Avoid_: Guest（匿名・未ログインの意味と混同するため）

**Submission evidence**:
AtCoder上の提出結果を外部から受け取った、まだ勝敗に利用できるとは確定していない情報。

**Pending submission（判定待ち提出）**:
Matchの制限時間内にAtCoderへ提出されたものの、ACなどの最終判定がまだ確定していない提出。時間切れ時にMatchを即座に引き分けへ確定してよいかを判断するために区別する。

**Confirmed result**:
対戦のルールに照らして検査され、Matchの状態や勝敗へ反映できる結果。

**Forfeit（棄権）**:
対戦中のParticipantが、自分の意思でMatchから降りると明示すること。相手Participantの勝利として結果を確定する。一時的な通信切断はForfeitとして扱わない。

**Unlisted Match result（限定公開の対戦結果）**:
検索一覧や検索エンジンには掲載せず、推測困難なMatch URLを知る人だけが閲覧できる対戦結果。URLを受け取った人は閲覧できるが、Matchを編集する権限は得ない。
