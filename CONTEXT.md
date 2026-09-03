# Project context

## 目的

問題セットを探す、練習する、友達と対戦する、良いセットを共有する、という循環を作ります。

## 用語

- Problem set: 条件生成または手動編集した問題の並び。
- Contest mode: 制限時間内の複数問題で順位を競う方式。
- Battle mode: 1問ずつ競い、先にACした参加者がラウンドを取る方式。
- Room: 対戦参加者、READY状態、ルール、進行中ラウンドを持つ単位。
- Submission evidence: AtCoder上の提出結果をuserscriptから受け取った未検証イベント。
- Confirmed result: サーバー側の検査を通り、対戦状態へ反映できる結果。

## 現在の優先順

1. Claude Designの画面設計を保存する。
2. Grill with docsで境界ごとにADRを決める。
3. 主要フローのシーケンス図を作る。
4. Fake ACでBattle modeの縦切りMVPを実装する。
5. AtCoder userscript通知を接続する。
