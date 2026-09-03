# Sequence diagrams

ADR確定後、Mermaidのsequence diagramを次の順序で追加します。

1. Room作成 → 参加 → READY → START
2. Fake AC → 勝者確定 → 全参加者へ配信
3. userscript通知 → 検査 → 重複排除 → 結果反映
4. 切断 → 再接続 → state同期
5. 条件入力 → 候補抽出 → seed付き選択 → set保存

各図には正常系だけでなく、タイムアウト、重複イベント、遅着イベントの分岐を含めます。
