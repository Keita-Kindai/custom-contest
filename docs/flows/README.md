# Sequence diagrams

ADR確定後、Mermaidのsequence diagramを次の順序で追加します。

1. Room作成 → 参加 → READY → START
2. Fake AC → 勝者確定 → 全参加者へ配信
3. userscript通知 → 検査 → 重複排除 → 結果反映
4. 切断 → 再接続 → state同期
5. 条件入力 → 候補抽出 → seed付き選択 → set保存

各図には正常系だけでなく、タイムアウト、重複イベント、遅着イベントの分岐を含めます。

## 作成済み

- `0001-room-match.md`: Room作成、polling、READY、開始、中止、再戦
- `0002-submission-evidence.md`: userscript接続、判定通知、再送、遅着、時間切れ
- `0003-result-persistence.md`: DB境界、結果保存再試行、限定公開結果、90日削除
- `0004-demo-verification.md`: 自動check、2人browser E2E、screenshot、実AtCoder手動確認
- `0005-problem-selection.md`: 固定JSON生成、seed付き抽選、Room内重複除外、利用不能時
- `0006-sunday-demo-runbook.md`: PostgreSQL、LAN server、userscript導入、対戦、復旧手順
