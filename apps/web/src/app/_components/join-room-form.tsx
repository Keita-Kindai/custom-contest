"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { JoinedRoomResponse } from "@custom-contest/contracts";

import { apiJson, getAtcoderId, getParticipantKey, saveParticipantKey } from "./client-storage";

const allowed = /[^A-HJ-NP-Z2-9]/g;

export function JoinRoomForm() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRoomId(value: string) {
    setRoomId(value.toUpperCase().replace(allowed, "").slice(0, 6));
  }

  async function joinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (roomId.length !== 6) return;
    setIsJoining(true);
    setError(null);
    try {
      const response = await apiJson<JoinedRoomResponse>(`/api/rooms/${roomId}/join`, {
        method: "POST",
        body: JSON.stringify({
          atcoderId: getAtcoderId(),
          participantKey: getParticipantKey(roomId) ?? undefined,
        }),
      });
      saveParticipantKey(roomId, response.participantKey);
      router.push(`/battle/r/${roomId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Roomへ参加できませんでした。");
      setIsJoining(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={joinRoom}>
      <div className="field">
        <label className="field-label" htmlFor="room-id">Room ID</label>
        <input
          className="input room-code-input"
          id="room-id"
          value={roomId}
          onChange={(event) => updateRoomId(event.target.value)}
          autoComplete="off"
          inputMode="text"
          maxLength={6}
          placeholder="K7M2QX"
          spellCheck={false}
          aria-describedby="room-id-help"
          autoFocus
        />
        <p className="field-help" id="room-id-help">貼り付けできます。I・O・0・1を除く大文字英数字6桁です。</p>
      </div>
      <div className="action-row">
        <button className="button button-primary" type="submit" disabled={roomId.length !== 6 || isJoining}>
          {isJoining ? "Roomを確認中…" : "参加する"}
        </button>
      </div>
      {error && <p className="status-banner" role="alert">{error}</p>}
    </form>
  );
}
