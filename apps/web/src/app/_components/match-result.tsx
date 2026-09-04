"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { StoredMatchResponse } from "@custom-contest/contracts";

import { apiJson } from "./client-storage";

function elapsed(match: StoredMatchResponse, seat: "host" | "invitee"): string {
  const ac = match.submissions.find((entry) => entry.seat === seat && entry.verdict === "AC");
  if (!ac) return "—";
  const seconds = Math.max(0, Math.floor((Date.parse(ac.submittedAt) - Date.parse(match.startedAt)) / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MatchResult({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<StoredMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<StoredMatchResponse>(`/api/matches/${matchId}`)
      .then((value) => { if (!cancelled) setMatch(value); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "結果を読み込めませんでした。"); });
    return () => { cancelled = true; };
  }, [matchId]);

  if (!match) {
    return <section className="empty-state"><strong>{error ? "結果を開けませんでした" : "結果を読み込み中…"}</strong><span>{error ?? "PostgreSQLまたは進行中サーバーから確認しています。"}</span><Link className="button button-quiet" href="/">トップへ戻る</Link></section>;
  }

  const title = match.outcome === "draw" ? "DRAW" : match.outcome === "void" ? "VOID" : "MATCH COMPLETE";
  return (
    <>
      <header className="result-head">
        <div><p className="kicker">{title}</p><h1>{match.outcome === "win" ? "1 — 0" : match.outcome.toUpperCase()}</h1></div>
        <div className="result-trust"><span className="status-dot" aria-hidden="true" /><strong>{match.verificationLabel}</strong><small>Match {match.matchId}</small></div>
      </header>

      <section className="result-players" aria-label="対戦結果">
        {match.participants.map((participant, index) => {
          const outcome = match.winnerSeat === participant.seat
            ? "WIN"
            : match.outcome === "win" ? "LOSE" : match.outcome.toUpperCase();
          return (
            <div key={participant.seat} style={{ display: "contents" }}>
              {index === 1 && <div className="versus" aria-hidden="true">VS</div>}
              <article className={participant.seat === "invitee" ? "result-opponent" : undefined}>
                <span className={`player-tag ${participant.seat === "invitee" ? "opponent-tag" : ""}`}>{participant.seat.toUpperCase()}</span>
                <h2>{participant.atcoderId}</h2><strong className="result-time">{elapsed(match, participant.seat)}</strong>
                <dl><div><dt>提出</dt><dd>{participant.submissionCount}回</dd></div><div><dt>ミス</dt><dd>{participant.missCount}回</dd></div><div><dt>結果</dt><dd className={`result-outcome result-${outcome.toLowerCase()}`}>{outcome}</dd></div></dl>
              </article>
            </div>
          );
        })}
      </section>

      <section className="section-block">
        <div className="section-heading"><h2>出題</h2><span className="section-note">Difficultyは目安</span></div>
        <dl className="spec-list">
          <div className="spec-row"><dt>PROBLEM</dt><dd><a href={match.problem.url} target="_blank" rel="noreferrer">{match.problem.contestId.toUpperCase()} {match.problem.problemIndex} — {match.problem.title}</a></dd><dd>{match.problem.difficulty === null ? "—" : `Difficulty ${match.problem.difficulty}`}</dd></div>
          <div className="spec-row"><dt>RULE</dt><dd>サーバーへ先着した有効AC</dd><dd>ペナルティなし</dd></div>
          <div className="spec-row"><dt>ROOM</dt><dd>{match.roomId}</dd><dd>BO1 · {match.limitMinutes}分</dd></div>
          <div className="spec-row"><dt>REASON</dt><dd>{match.reason}</dd><dd>{match.detail ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="result-actions"><div><h2>同じRoomへ戻る</h2><p>参加者キーがこの端末に残っていれば、再戦を申し込めます。</p></div><div className="action-row"><Link className="button button-primary" href={`/battle/r/${match.roomId}`}>Roomへ戻る</Link><Link className="button button-quiet" href="/">トップへ戻る</Link></div></section>
    </>
  );
}
