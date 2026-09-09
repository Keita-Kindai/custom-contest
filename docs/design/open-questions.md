# Design open questions

`design_handoff_ac_duel_bo1` を 2026-09-03 に受領し、Grilling を開始しました。

| ID | 画面 / component | 判断点 | 担当 | 状態 |
| --- | --- | --- | --- | --- |
| DESIGN-001 | 全体 | Claude Design の成果物を受領する | Claude Design | Resolved |
| DESIGN-002 | MVP全体 | 画面Handoffの「ローカルモックのUI試作」と `docs/product/mvp.md` の「サーバー同期・結果保存までの縦切り」のどちらを次の実装境界とするか | User | Resolved: 縦切りMVP |
| DESIGN-003 | 参加者 / ログイン | 「ゲスト参加なし」と「ゲストが Room ID で参加」の用語と認証境界を統一する | User | Resolved: 招待参加者 |
| DESIGN-004 | 勝敗確定 | 「一方の AC を取得した時点で終了」と「AtCoder の提出時刻が早い側の勝ち」を、ポーリングの遅延下でどう両立させるか | User | Resolved: サーバーへ先着した有効ACで即時確定 |
| DESIGN-005 | Room / 対戦 / ラウンド | 再戦時に Room を再利用する前提で、結果を持つ単位と問題1問の単位を呼び分ける | User | Resolved: Room / Match / Round |
| DESIGN-006 | スマートフォン | 参加リンクをスマートフォンで開いた場合に、対戦参加と Room 作成をどこまで許すか | User | Resolved: PC・タブレット限定 |
| DESIGN-007 | Room招待 | Room IDだけでなく招待URLを主導線にするか | User | Resolved: URL + Room ID |
| DESIGN-008 | Match結果 | Roomを再利用しても過去の結果を参照できるURL構造にするか | User | Resolved: Match専用URL |
| DESIGN-009 | デモ操作 | Fake提出の操作を通常の対戦体験からどう分離するか | User | Resolved: 折りたたみ式 |
| DESIGN-010 | AtCoder提出検知 | 日曜デモまでに実際のAC判定を必須にするか、上積み目標にするか | User | Resolved: userscriptで必須 |
| DESIGN-011 | AtCoder連携 | userscriptとRoomの参加者をどう安全に対応付け、接続状態をどう見せるか | User | Resolved: 一回限りのfragment接続キー + 15秒heartbeat |
| DESIGN-012 | 勝敗確定 | 同一秒のACを取りこぼさないため、最初のAC検知後にどの状態まで待つか | User | Resolved: 待機せず先着で確定、後着では変更しない |
| DESIGN-013 | AtCoder連携 | ブラウザー拡張機能を使うか、インストール不要方式へ切り替えるか | User | Resolved: Tampermonkey userscript |
| DESIGN-014 | AtCoder連携 | 対戦中にuserscript接続が途切れたとき、Matchとタイマーを停止するか | User | Resolved: 停止せず警告・自動再接続 |
| DESIGN-015 | 時間切れ | 制限時間内の提出がWJのまま時間切れを迎えた場合、いつ結果を確定するか | User | Resolved: 最終判定を最大5分待機 |
| DESIGN-016 | 画面同期 | 日曜デモでSocket.IO / WebSocketを導入するか、通常HTTPで定期取得するか | User | Resolved: 1秒HTTP polling |
| DESIGN-017 | Room状態 | サーバーと各ブラウザーのどちらを共有状態の正本にするか | User | Resolved: 単一Next.jsサーバー |
| DESIGN-018 | 切断 | Participantの一時切断を60秒後の不戦敗として扱うか | User | Resolved: 自動不戦敗なし、明示的なForfeitのみ |
| DESIGN-019 | 問題公開 | HTTP polling下で問題を事前配信するか、START後の僅かな表示差を許容するか | User | Resolved: 事前配信せず数百ミリ秒程度を許容 |
| DESIGN-020 | AtCoder ID | プロフィールとログイン中のAtCoder IDが異なる場合、および同一IDでの対戦を許可するか | User | Resolved: READY不可、同一ID参加不可 |
| DESIGN-021 | Match開始 | 両者READYで自動開始するか、ホストの開始操作を必要とするか | User | Resolved: ホスト操作後に3秒countdown |
| DESIGN-022 | 画面同期 | Room snapshotを取得できない場合、いつ警告し操作を止めるか | User | Resolved: 3秒で再接続表示・共有操作無効 |
| DESIGN-023 | Forfeit | 誤操作を防ぎながら棄権をどう確定するか | User | Resolved: 対戦中の確認modal |
| DESIGN-024 | Countdown | START前の取消を誰が行え、READY状態をどう戻すか | User | Resolved: どちらも取消可能、両者READY解除 |
| DESIGN-025 | Room退出 | 明示的退出と一時切断をどう区別し、ホスト権限を譲渡するか | User | Resolved: Invitee席解放、HostはRoom終了、譲渡なし |
| DESIGN-026 | 再戦 | Roomを再利用するか、条件と問題をどう引き継ぐか | User | Resolved: 両者承認、同条件、新規抽選 |
| DESIGN-027 | Room寿命 | 接続のない待機Roomをいつ閉じるか | User | Resolved: 非対戦時に両者無接続30分 |
| DESIGN-028 | userscript接続 | 一回限りの接続キーと継続利用する専用トークンの有効範囲 | User | Resolved: 5分・1回、Room退出/終了まで |
| DESIGN-029 | 提出履歴 | userscriptから送信・保存する提出情報と、収集しない情報 | User | Resolved: 最小メタデータ、ソース本文・コード長なし |
| DESIGN-030 | 通知再送 | 通信失敗時の再送、受信確認、重複通知をどう扱うか | User | Resolved: ACKまで再送、提出IDで重複排除 |
| DESIGN-031 | 遅着通知 | 勝敗確定後に届いた正しい提出を履歴へ残すか | User | Resolved: 結果を変えず遅着として保存 |
| DESIGN-032 | 信頼境界 | client側userscriptを改造した不正を初期段階でどこまで防ぐか | User | Resolved: 招待制カジュアル対戦、公開競技前に再検討 |
| DESIGN-033 | READY条件 | heartbeatだけでなくAtCoderの読取成功を要求するか | User | Resolved: ログイン・ID一致・判定先アクセスを要求 |
| DESIGN-034 | AtCoder導線 | 問題をどこで開き、判定取得に手動操作を必要とするか | User | Resolved: 別tabで開き自動検知 |
| DESIGN-035 | 提出filter | 対象問題以外の提出を送信・保存するか | User | Resolved: clientで限定しserverで再検査 |
| DESIGN-036 | 提出表示 | 対戦中に相手の提出詳細をどこまで見せるか | User | Resolved: 最新判定・回数・WJ、詳細は結果後 |
| DESIGN-037 | Verdict表示 | OLEやIEを特別扱いするか、AtCoderの確定ラベルを表示するか | User | Resolved: 確定labelをそのまま表示、AC以外は非勝利 |
| DESIGN-038 | 拒否通知 | serverがSubmission evidenceを拒否した理由を誰へどう見せるか | User | Resolved: 本人へ修正案、相手へ一般表示 |
| DESIGN-039 | 信頼度表示 | client確認の結果を公式検証済みと区別するか | User | Resolved: userscript確認・カジュアル対戦 |
| DESIGN-040 | ペナルティ | 不正解ごとの+1分を勝敗または表示へ使うか | User | Resolved: penaltyなし、提出・miss回数のみ |
| DESIGN-041 | Fake提出 | Fake判定を公開版にも残すか | User | Resolved: LAN demo・開発・test限定 |
| DESIGN-042 | 初回公開 | 招待制client確認版を先に公開するか、不正対策完成まで待つか | User | Resolved: 招待制casual版を先行公開 |
| DESIGN-043 | VOID | 無効Matchを完全に破棄するか、原因と結果URLを保存するか | User | Resolved: 保存するが戦績対象外 |
| DESIGN-044 | Match結果 | 結果URLを参加者限定にするか、URLを知る人へ限定公開するか | User | Resolved: 推測困難な限定公開link |
| DESIGN-045 | Database access | SQLを直接扱うか、DrizzleまたはPrismaを使うか | User | Resolved: Drizzle + pg |
| DESIGN-046 | Database境界 | プレイヤーのブラウザーがDBへ直接接続するか | User | Resolved: 両者ともAPIのみ、serverだけDB接続 |
| DESIGN-047 | Match保存期間 | 完了Matchをいつ自動削除するか | User | Resolved: 90日、起動時・日次lazy cleanup |
| DESIGN-048 | Database障害 | 対戦中に保存先が停止した場合、Matchを中断するか | User | Resolved: 継続し5秒再試行、保存まで再戦不可 |
| DESIGN-049 | Test構成 | unit、API、browser、実AtCoder確認をどう分担するか | User | Resolved: Vitest + Playwright Chromium + 手動実提出 |
| DESIGN-050 | Browser E2E | 2人フローと12状態をどこまで自動検証するか | User | Resolved: core flow assert + 状態screenshot |
| DESIGN-051 | 実AtCoder確認 | 実提出を自動化するか、誰のデータで手動確認するか | User | Resolved: 本人操作、Litms・許可済み友人のみ |
| DESIGN-052 | Screenshot証跡 | 起動から設定、Match、結果までの画面を残すか | User | Resolved: Playwrightで主要画面を保存 |
| DESIGN-053 | 日曜問題範囲 | 参加者の習熟度に合わせてDifficultyを400〜800へ狭めるか | User | Resolved: ABC C/D・400〜1200を維持 |
| DESIGN-054 | 既出問題 | 両者が過去に解いた問題を初期段階から除外するか | User | Resolved: 初期は許容、Problems連携時に再検討 |
| DESIGN-055 | Rating表示 | 取得していないAtCoder Ratingを画面へ表示するか | User | Resolved: 初期は非表示 |
| DESIGN-056 | 直近の対戦 | 限定公開結果をAtCoder IDで検索するか、端末内履歴だけにするか | User | Resolved: localの直近3件のみ |
| DESIGN-057 | Difficulty表示 | 非公式Difficultyをどう表記し、欠損時にどうするか | User | Resolved: 目安表記、欠損時は非表示 |
| DESIGN-058 | 問題source | 日曜のMatch開始時にAtCoder Problemsへ問い合わせるか | User | Resolved: 事前生成した固定JSON |
| DESIGN-059 | 問題cache | 初回公開後のほぼ全問題を外部APIから毎回取得するか | User | Resolved: 定期取込したDB cache |
| DESIGN-060 | Top | 問題セット等の未実装導線を初期画面へ置くか | User | Resolved: 対戦とlocal履歴だけ |
| DESIGN-061 | Profile | Room参加中にAtCoder IDの変更を許すか | User | Resolved: Room外だけ、再接続必須 |
| DESIGN-062 | 再抽選 | 同じRoomで同じ問題が続けて出ることを許すか | User | Resolved: 全候補消化まで重複なし |
| DESIGN-063 | 問題利用不能 | START前後にAtCoder問題を開けない場合の結果 | User | Resolved: 前は再抽選、後はVOID |
| DESIGN-064 | Invitee席 | 明示的に退出しないInviteeの席をホストが空けられるか | User | Resolved: Waiting中のみ確認modalで可能 |
| DESIGN-065 | 日曜優先度 | 遅延時に何を残し何を後ろへ回すか | User | Resolved: 全項目を目指しgame成立順で実装 |
| DESIGN-066 | Visual品質 | pixel一致とgame機能のどちらを日曜に優先するか | User | Resolved: game機能優先、visual細部は低優先 |
| DESIGN-067 | AtCoder取得頻度 | heartbeatと提出pollによるAtCoderへの重複accessを許容するか | User | Resolved: 到達確認は最大15秒に1回、対戦中の提出確認は5秒に1回の単一loopとし、同時実行しない。接続専用のAtCoderトップタブだけで動かす |
| DESIGN-068 | userscript接続表示 | AtCoder上の接続通知を常時表示するか | User | Resolved: 初回接続・再接続成功は4秒で消し、障害中だけ継続表示 |
| DESIGN-069 | 勝敗表示 | LOSEをWINと同じgreenで表示するか | User | Resolved: LOSEは既存danger tokenのredにし、色に加えてLOSE文字も維持 |
| DESIGN-070 | START遷移 | STARTと対戦画面の切替を即時にするか | User | Resolved: server上の開始時刻は変えず、live snapshot受信後もSTARTを0.8秒保持して画面だけ穏やかに切り替える |
| DESIGN-071 | 精進 / 見た目 | 精進側と対戦側の配色・書体を統一するか | User | Resolved: primitive共有の2 skin。精進=light+橙、対戦=dark+緑（ADR-0007） |
| DESIGN-072 | 精進 / 作成 | 作成ウィザードを条件生成（12章）とProblems検索（13章）のどちらにするか | User | Resolved: 13章のProblems検索して追加（ADR-0007） |
| DESIGN-073 | 精進 / 導線 | トップ`/`を統合トップへ作り替えるか | User | Resolved: 当面触らず`/discover`等を独立入口にする。統合は日曜デモ後（ADR-0007） |
| DESIGN-074 | 精進 / 認証 | 認証方式（メール / OAuth / AtCoder ID連携）と、未ログイン時に見せる範囲 | User | Resolved: GitHub / GoogleのOAuthのみ。パスワードは保存しない。AtCoder IDは自己申告で認証に使わない（ADR-0009）。未ログインで見せるのはDiscoverと公開セットの閲覧までで、作成・いいね・保存・AC記録はログイン必須（ADR-0011） |
| DESIGN-075 | 精進 / 公開範囲 | 限定公開リンクに期限や失効の仕組みを持たせるか | User | Open |
| DESIGN-076 | 精進 / 指標 | いいね数と使用回数を誰にでも見せるか、作成者だけに見せるか | User | Open |
| DESIGN-077 | 精進 / 運用 | 「公開停止」を誰がどの基準で行うか（運営判断 / 自動検知） | User | Open |
| DESIGN-078 | 精進 / 複製 | セット複製時に元の公開範囲を継承するか、下書きへ落とすか | User | Open |
| DESIGN-079 | 精進 / 問題data | 対戦の抽選poolと精進の検索poolをいつ一つのカタログへ統合するか | User | Open |
| DESIGN-080 | 精進 / 対応幅 | Discoverとライブラリをモバイル幅の保証対象に含めるか | User | Open |
| DESIGN-081 | 精進 / 作成 | 作成をステップ式（12章の5 step）にするか、1画面（13章のモック）にするか | User | Open: 13章が「3ステップに簡略化できる想定。ステップ数の最終形は次のラウンドで確定」としているため、現状は1画面で実装 |
| DESIGN-082 | 精進 / Difficulty | `is_experimental`のDifficulty推定値を表示するか伏せるか | User | Open: 現状は伏せて「—」を出す。ABC001〜のような古い回が該当 |
| DESIGN-089 | 配備 | 公開先をVercelにするか、常駐processのhostにするか | User | Resolved: 常駐process（Fly.io / Render）+ Neon（ADR-0009）。ただし2026-09-08時点でFly.ioに無料枠がなくRenderの無料DBは30日で期限切れになるため、精進側を先に公開する前提でADR-0010が選び直している |
| DESIGN-090 | 認証 | localStorageに残っている問題セットを、ログイン後のアカウントへどう引き継ぐか | User | Resolved: 引き継がない。現在あるのはデモ用のデータなので、アカウントへは移さない（ADR-0011） |
| DESIGN-091 | 認証 | Room作成と対戦参加にログインを必須にするか | User | Open: 現状は必須にしていない |
| DESIGN-083 | 精進 / 問題一覧 | 問題行から AtCoder へ移動する導線を、独立したボタンにするか問題名そのものにするか | User | Resolved: 問題名をリンクにし、「AtCoderで開く」ボタンは廃止 |
| DESIGN-084 | 精進 / 挑戦状態 | 解いたかどうかを本人の自己申告で持つか、AtCoderの提出履歴から自動判定するか | User | Resolved: 自己申告の3値（未AC / 自力AC / 解説AC）。problemId単位でセットをまたいで共有する。自動判定は認証と提出履歴取得の導入後に再検討 |
| DESIGN-085 | 精進 / 検索結果 | Discoverの検索結果を高密度の表にするか、検索前と同じカードにするか | User | Resolved: カードに統一。未使用だった`SetRow`と表headerは2026-09-08に削除 |
| DESIGN-086 | 対戦 / 導線 | 対戦側の画面から精進側へ進む導線を置くか | User | Resolved: トップと`/battle/new`に`/discover`へのリンクを置く。出題を問題セットから行う機能結合は別Issue |
| DESIGN-087 | デモ / 通信 | 遠隔デモの公開経路をVercelへの配備にするか、ホストPCへのtunnelにするか | User | Resolved: Cloudflare Tunnel。Room stateがprocess内のMapのため、serverlessでは複数instanceに分裂して壊れる |
| DESIGN-088 | 対戦 / BO3 | BO3を「Matchが最大3 Roundを含む」で表すか、「Seriesが最大3 Matchを含む」で表すか | User | Resolved: Seriesが最大3 Matchを含む（ADR-0008）。実装は日曜デモ後 |
| DESIGN-092 | 精進 / 色 | Difficultyの色をAtCoder準拠の8段にするか、brand accentを避けた独自6段のままにするか | User | Resolved: AtCoderのrating色8段。橙は枠線chipで描いてaccentと分ける（ADR-0007追記） |
| DESIGN-093 | 精進 / 一覧 | 挑戦状態を行に文字で出すか、印と色だけにするか | User | Resolved: 一覧は印（○ ● ◐）と色、文字は凡例へ集約 |
| DESIGN-094 | 精進 / 作成 | 公開範囲をいつ選ばせるか | User | Resolved: 常時表示をやめ、「保存する」を押した時点で選ぶ。下書きは非公開のまま |
| DESIGN-095 | 精進 / 指標 | 想定時間を出し続けるか | User | Resolved: 表示をやめ`estimateMinutes`を削除。代わりに作成者が選ぶ想定者を出す |
| DESIGN-096 | 精進 / 想定者 | 想定者を1色で持つか、範囲で持つか | User | Resolved: 段を複数押し、表示は押した段の色をその数だけ並べる。最小段〜最大段のレンジ表示は、押していない段まで含んで見えるため2026-09-07に廃止 |
| DESIGN-097 | 精進 / ライブラリ | 保存したセットを進み具合で分けるか | User | Resolved: 全てAC / 進行中 / 未着手。解説ACもACとして数える。全タブで使える切り替え |
| DESIGN-098 | 精進 / 検索 | 3295問のうち上位20件しか見られない状態をどうするか | User | Resolved: `offset`によるページ送りと表示件数の切り替え、ページ単位の一括追加 |
| DESIGN-099 | 精進 / 問題data | Codeforcesの問題をカタログへ入れるか | User | Open: 今回は入れない。rating体系とURL形式が異なるため別Issue |
| DESIGN-100 | 精進 / カード | タイトルとタグの長さがカードごとに違うとき、対象者・問題数・作成者の位置をどう揃えるか | User | Resolved: タイトルは2行で省略、タグ欄は2行で固定し入り切らない分を「+N」にまとめる。高さを固定した結果、下2段は全カードで同じ位置に並ぶ |
| DESIGN-101 | 精進 / カード | いいね数と公開範囲をカードのどこへ置くか | User | Resolved: 公開範囲をタイトル行の右端、いいね数を作成者名の行の右端。Discoverでは公開範囲を出さない |
| DESIGN-102 | 精進 / カード | タグが1つもないセットの見せ方 | User | Resolved: 破線枠の「タグなし」を表示だけ出す。契約のtag enumには加えず、検索の絞り込み対象にもしない |
| DESIGN-103 | 精進 / 作成 | 掴んで並べ替えるとき、落ちる先をどう見せるか | User | Resolved: 行を塗らず、差し込まれるすきまに線を出す。行を塗ると入れ替えに見えるが、実際は挿入で並べ替えるため |
| DESIGN-104 | 精進 / 作成 | 挑戦状態（未AC / 自力AC / 解説AC）を作成画面にも出すか | User | Resolved: 作成画面の検索結果と追加済みの両方から外す。記録はセット詳細で行う |
| DESIGN-105 | 精進 / 作成 | 見出しジャンプをページ上部に貼り付けるか、右カードへ入れるか | User | Resolved: 右の「追加済み」カードの最下部。カード自体が貼り付くので二重に貼り付けない |
| DESIGN-106 | 精進 / 作成 | 一括追加が契約の上限（50問）を超えられる状態をどうするか | User | Resolved: 上限で打ち切り、何問追加したかを通知する。保存直前に`problemSetSchema`で検証する |
| DESIGN-107 | 配備 | 精進側と対戦側のどちらを先に公開するか | User | Resolved: 精進側を先に公開する。精進側はprocess内に状態を持たないため、対戦側の制約を受けない（ADR-0010） |
| DESIGN-108 | 精進 / 挑戦状態 | ACの記録を問題単位で1つ持つか、セットごとに別々に持つか | User | Resolved: セットごと。セットは一続きの課題なので、進み具合はその中で数える。keyは`(user_id, set_id, problem_id)` |
| DESIGN-109 | 精進 / 作成者 | カードに出す作成者名をAtCoder IDにするか、OAuthの表示名にするか | User | Resolved: 「ユーザー名」として持つ。初回ログイン時にOAuthの表示名を`users.display_name`へ写し、あとから変更できる。AtCoder IDは自己申告の別項目として残す |
| DESIGN-110 | 精進 / 問題data | 問題カタログをDBへ入れて参照するか、セットごとに問題情報をコピーし続けるか | User | Resolved: `problems` tableへ入れて参照する。コピーのままだとDifficultyの更新が過去のセットへ届かない（ADR-0011）。ただし問題検索はDBを叩かず固定JSONを引く（DESIGN-115） |
| DESIGN-111 | 精進 / schema | タグと想定者を配列列で持つか、中間tableに分けるか | User | Resolved: `text[]` + GIN index。値の集合が固定で属性を持たないため、中間tableはJOINが増えるだけ |
| DESIGN-112 | 精進 / 指標 | 「使用回数」を何の数として定義するか | User | Resolved: 廃止する。何を数えているのか説明できないため、列ごと作らない。contractsの`useCount`も外す |
| DESIGN-113 | 精進 / 退会 | 利用者が退会したとき、その人が公開したセットをどうするか | User | Resolved: `ON DELETE CASCADE`で一緒に消す。「全部消したい」に応えられる形を優先する |
| DESIGN-114 | 配備 | 公開構成を Vercel + Neon にするか Vercel + Supabase にするか | User | Resolved: Vercel + Neon。Auth.jsを残す以上Supabaseの利点はStorageとRealtimeだけで、どちらも使わない。Supabase無料は7日の無操作で停止し、一般公開直後に黙って止まるのが最も避けたい壊れ方（ADR-0010） |
| DESIGN-115 | 精進 / 検索 | 問題検索をDBに当てるか、固定JSONのままにするか | User | Resolved: 固定JSONのまま。入力のたびに走る最多の処理なので、DBに当てるとNeonの月100 CU-hoursをここで使い切る。`problems` tableは外部キーの参照先と表示時のJOINに使う |
| DESIGN-116 | 精進 / 問題data | カタログの流し込みをいつ走らせるか | User | Resolved: deployのたびに自動でUPSERT。手動にすると忘れたときに外部キー違反で保存が失敗する |
