"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { JoinedRoomResponse } from "@custom-contest/contracts";

import { apiJson, getAtcoderId, saveParticipantKey } from "./client-storage";

export function CreateRoomForm() {
  const router = useRouter();
  const [duration, setDuration] = useState("10");
  const [symbols, setSymbols] = useState(["C", "D"]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSymbol(symbol: string) {
    setSymbols((current) =>
      current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol],
    );
  }

  async function createRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (symbols.length === 0) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await apiJson<JoinedRoomResponse>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          atcoderId: getAtcoderId(),
          limitMinutes: Number(duration),
          problemIndexes: symbols,
        }),
      });
      saveParticipantKey(response.roomId, response.participantKey);
      router.push(`/battle/r/${response.roomId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Roomを作成できませんでした。");
      setIsCreating(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={createRoom}>
      <fieldset className="field">
        <legend>モード</legend>
        <div className="mode-strip">
          <label className="choice">
            <input type="radio" name="mode" defaultChecked /> BO1
          </label>
          <span className="choice" aria-disabled="true">BO3 — 後日</span>
          <span className="choice" aria-disabled="true">BO5 — 後日</span>
        </div>
      </fieldset>

      <div className="field">
        <label className="field-label" htmlFor="duration">制限時間</label>
        <select className="select" id="duration" value={duration} onChange={(event) => setDuration(event.target.value)}>
          <option value="10">10分</option>
          <option value="20">20分</option>
          <option value="30">30分</option>
        </select>
        <p className="field-help">日曜デモの既定値は10分です。</p>
      </div>

      <fieldset className="field">
        <legend>出題する問題記号</legend>
        <div className="choice-strip">
          {(["C", "D"] as const).map((symbol) => (
            <label className="choice" key={symbol}>
              <input
                type="checkbox"
                checked={symbols.includes(symbol)}
                onChange={() => toggleSymbol(symbol)}
              />
              ABC {symbol}
            </label>
          ))}
        </div>
        <p className={`field-help ${symbols.length === 0 ? "error-text" : ""}`}>
          {symbols.length === 0
            ? "出題範囲が空です。CまたはDを1つ以上選んでください。"
            : "Difficulty 400〜1200を目安に、START時に1問抽選します。"}
        </p>
      </fieldset>

      <dl className="spec-list" aria-label="Room設定の確認">
        <div className="spec-row"><dt>FORMAT</dt><dd>1問先取</dd><dd>BO1</dd></div>
        <div className="spec-row"><dt>TIME LIMIT</dt><dd>制限時間</dd><dd>{duration}分</dd></div>
        <div className="spec-row"><dt>PROBLEM POOL</dt><dd>ABC {symbols.join(" / ") || "未選択"}</dd><dd>Diff. 400–1200</dd></div>
      </dl>

      <div className="action-row">
        <button className="button button-primary" type="submit" disabled={symbols.length === 0 || isCreating}>
          {isCreating ? "Roomを作成中…" : "Roomを作成"}
        </button>
        <span className="helper">作成後、招待URLをコピーできます。</span>
      </div>
      {error && <p className="status-banner" role="alert">{error}</p>}
    </form>
  );
}
