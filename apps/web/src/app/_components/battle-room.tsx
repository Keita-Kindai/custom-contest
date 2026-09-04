"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  COUNTDOWN_MS,
  PARTICIPANT_KEY_HEADER,
  type IssueLinkKeyResponse,
  type RoomSnapshot,
  type SnapshotResponse,
  type SubmissionEntry,
} from "@custom-contest/contracts";

import {
  apiJson,
  getAtcoderId,
  getParticipantKey,
  saveParticipantKey,
  saveRecentMatchPath,
} from "./client-storage";

const verdictCopy: Record<string, { mark: string; detail: string }> = {
  WJ: { mark: "◐", detail: "判定待ち" },
  WA: { mark: "×", detail: "不正解" },
  TLE: { mark: "◷", detail: "実行時間超過" },
  MLE: { mark: "!", detail: "メモリ超過" },
  RE: { mark: "!", detail: "実行時エラー" },
  CE: { mark: "!", detail: "コンパイルエラー" },
  AC: { mark: "✓", detail: "正解" },
};

const START_TRANSITION_HOLD_MS = 800;

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  const label = verdict ?? "WJ";
  const copy = verdictCopy[label] ?? { mark: "·", detail: "判定" };
  return (
    <span className={`verdict verdict-${label.toLowerCase()}`} aria-label={`${label}、${copy.detail}`}>
      <span aria-hidden="true">{copy.mark}</span> {label} <small>{copy.detail}</small>
    </span>
  );
}

function elapsed(entry: SubmissionEntry, startsAt: string): string {
  return formatClock(Math.max(0, Math.floor((Date.parse(entry.submittedAt) - Date.parse(startsAt)) / 1000)));
}

export function BattleRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [participantKey, setParticipantKey] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("招待URLをコピー");
  const [reconnecting, setReconnecting] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [startHoldUntil, setStartHoldUntil] = useState(0);
  const lastSuccess = useRef(0);
  const lastRevision = useRef(-1);
  const previousView = useRef<RoomSnapshot["view"] | null>(null);
  const previousMatchId = useRef<string | null>(null);
  const forfeitDialog = useRef<HTMLDialogElement>(null);

  const updateSnapshot = useCallback((next: RoomSnapshot) => {
    // 取得自体は成功しているので、古いsnapshotでも再接続表示は解除する。
    lastSuccess.current = Date.now();
    setReconnecting(false);
    setFatalError(null);

    // 遅れて届いたpolling応答が、新しいsnapshotを巻き戻さないようにする（ADR-0002 / ADR-0003）。
    if (next.revision < lastRevision.current) return;
    lastRevision.current = next.revision;

    const nextMatchId = next.match?.matchId ?? null;
    if (nextMatchId !== previousMatchId.current) setStartHoldUntil(0);
    if (previousView.current === "countdown" && next.view === "live") {
      setStartHoldUntil(Date.now() + START_TRANSITION_HOLD_MS);
    }
    previousView.current = next.view;
    previousMatchId.current = nextMatchId;
    setSnapshot(next);
    setServerOffset(Date.parse(next.serverTime) - Date.now());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function bootstrap() {
      try {
        let key = getParticipantKey(roomId);
        if (!key) {
          const joined = await apiJson<{ participantKey: string; snapshot: RoomSnapshot }>(
            `/api/rooms/${roomId}/join`,
            { method: "POST", body: JSON.stringify({ atcoderId: getAtcoderId() }) },
          );
          key = joined.participantKey;
          saveParticipantKey(roomId, key);
          if (!cancelled) updateSnapshot(joined.snapshot);
        }
        if (!cancelled) setParticipantKey(key);

        const poll = async () => {
          if (cancelled || !key) return;
          try {
            const response = await apiJson<SnapshotResponse>(`/api/rooms/${roomId}`, {
              headers: { [PARTICIPANT_KEY_HEADER]: key },
            });
            if (!cancelled) updateSnapshot(response.snapshot);
          } catch (cause) {
            if (!cancelled) {
              if (!lastSuccess.current) setFatalError(cause instanceof Error ? cause.message : "Roomへ接続できません。");
              else if (Date.now() - lastSuccess.current >= 3_000) setReconnecting(true);
            }
          } finally {
            if (!cancelled) timer = window.setTimeout(poll, 1_000);
          }
        };
        await poll();
      } catch (cause) {
        if (!cancelled) setFatalError(cause instanceof Error ? cause.message : "Roomへ参加できません。");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [roomId, updateSnapshot]);

  async function mutate(path: string, body: Record<string, unknown> = {}) {
    if (!participantKey || reconnecting) return;
    setBusy(path);
    setActionError(null);
    try {
      const response = await apiJson<SnapshotResponse>(`/api/rooms/${roomId}/${path}`, {
        method: "POST",
        body: JSON.stringify({ participantKey, ...body }),
      });
      updateSnapshot(response.snapshot);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "操作を完了できませんでした。");
    } finally {
      setBusy(null);
    }
  }

  async function connectAtCoder() {
    if (!participantKey) return;
    const popup = window.open("about:blank", "_blank");
    setBusy("link-key");
    setActionError(null);
    try {
      const response = await apiJson<IssueLinkKeyResponse>(`/api/rooms/${roomId}/link-key`, {
        method: "POST",
        body: JSON.stringify({ participantKey }),
      });
      updateSnapshot(response.snapshot);
      if (popup) popup.location.href = response.handoffUrl;
      else setActionError("AtCoderのタブを開けませんでした。ポップアップを許可して、もう一度接続してください。");
    } catch (cause) {
      popup?.close();
      setActionError(cause instanceof Error ? cause.message : "AtCoderへ接続できませんでした。");
    } finally {
      setBusy(null);
    }
  }

  async function fakeSubmission(status: "pending" | "final", verdict?: string) {
    if (!participantKey) return;
    setBusy(`fake-${verdict ?? status}`);
    try {
      const response = await apiJson<SnapshotResponse>("/api/dev/fake-evidence", {
        method: "POST",
        body: JSON.stringify({ participantKey, status, verdict, language: "Fake" }),
      });
      updateSnapshot(response.snapshot);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Fake判定を送れませんでした。");
    } finally {
      setBusy(null);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/battle/r/${roomId}`);
      setCopyStatus("コピーしました");
    } catch {
      setCopyStatus("URL欄からコピーしてください");
    }
    window.setTimeout(() => setCopyStatus("招待URLをコピー"), 2_200);
  }

  async function leaveInviteeSeat() {
    if (!participantKey || !window.confirm("このRoomから退出しますか？ 退出すると、この端末の参加者キーは使えなくなります。")) return;
    setBusy("leave");
    try {
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantKey, action: "leave" }),
      });
      if (!response.ok) throw new Error("Roomから退出できませんでした。");
      router.push("/");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Roomから退出できませんでした。");
      setBusy(null);
    }
  }

  const effectiveNow = clock + serverOffset;
  const match = snapshot?.match ?? null;
  const countdown = match
    ? Math.min(COUNTDOWN_MS / 1_000, Math.max(0, Math.ceil((Date.parse(match.startsAt) - effectiveNow) / 1_000)))
    : 0;
  const remaining = match ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - effectiveNow) / 1_000)) : 0;
  const selfSubmissions = match?.submissions.filter((entry) => entry.seat === snapshot?.viewerSeat) ?? [];
  const selfLatest = selfSubmissions.at(-1);
  const opponentName = snapshot?.opponent?.atcoderId ?? "待機中…";
  const isFakeOpponent = snapshot?.opponent?.kind === "fake";
  const isHost = snapshot?.viewerSeat === "host";
  const disabled = busy !== null || reconnecting;
  const startHoldActive = snapshot?.view === "live" && clock < startHoldUntil;

  useEffect(() => {
    if (match?.result && match.persistence === "saved") saveRecentMatchPath(match.result.matchPath);
  }, [match?.persistence, match?.result]);

  if (!snapshot) {
    return (
      <div className="desktop-app battle-app">
        <main className="countdown-main">
          <p className="kicker">ROOM {roomId}</p>
          <h1>{fatalError ? "Roomへ入れませんでした" : "Roomへ接続中…"}</h1>
          <p>{fatalError ?? "参加者情報と最新の状態を確認しています。"}</p>
          {fatalError && <Link className="button button-primary" href="/">プロフィールを確認する</Link>}
        </main>
      </div>
    );
  }

  const resultLabel = match?.result?.outcome === "draw"
    ? "DRAW"
    : match?.result?.outcome === "void"
      ? "VOID"
      : match?.result?.winnerSeat === snapshot.viewerSeat ? "WIN" : "LOSE";

  return (
    <>
      <section className="mobile-gate" aria-labelledby="room-mobile-title">
        <p className="mono-label">ROOM {roomId}</p>
        <h1 id="room-mobile-title">PCで対戦を続けてください</h1>
        <p>AtCoderと並べて表示するため、この画面は横幅1024px以上で利用できます。</p>
      </section>

      <div className="desktop-app battle-app">
        <header className="battle-header">
          <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true" /> AC Duel</Link>
          <span className="header-divider" aria-hidden="true" />
          <div className="room-identity"><span>ROOM</span><strong>{roomId}</strong></div>
          <button className="compact-button" type="button" onClick={copyInvite}>{copyStatus}</button>
          <span className="mode-chip">BO1 · {snapshot.settings.limitMinutes}分</span>
          <div className="battle-header-spacer" />
          <span className="connection-indicator"><span className="status-dot" aria-hidden="true" /> {reconnecting ? "再接続中" : "接続中"}</span>
          <span className="header-user">{snapshot.self.atcoderId}</span>
        </header>

        {(reconnecting || actionError || snapshot.notices.at(-1)) && (
          <p className="status-banner" role="status">
            {reconnecting ? "サーバーへ再接続中です。タイマーは進み続けます。" : actionError ?? snapshot.notices.at(-1)?.message}
          </p>
        )}

        {snapshot.view === "closed" && (
          <main className="countdown-main"><p className="kicker">ROOM CLOSED</p><h1>このRoomは終了しました</h1><p>トップから新しいRoomを作成できます。</p><Link className="button button-primary" href="/">トップへ戻る</Link></main>
        )}

        {snapshot.view === "waiting" && (
          <main className="waiting-main">
            <section className="waiting-intro">
              <div><p className="kicker">WAITING ROOM</p><h1>両者の準備を確認</h1></div>
              <div className="invite-block"><span>招待する相手へ送る</span><strong>{roomId}</strong><button className="button button-primary" type="button" onClick={copyInvite}>{copyStatus}</button></div>
            </section>

            <section className="player-slots" aria-label="参加者">
              <article className={`player-slot self-slot ${snapshot.self.ready ? "is-ready" : ""}`}>
                <div className="slot-top"><span className="player-tag">YOU</span><span>{snapshot.viewerSeat.toUpperCase()}</span></div>
                <h2>{snapshot.self.atcoderId}</h2><p>{snapshot.self.script.hint ?? "AtCoder接続を確認済み"}</p><strong className="ready-state">{snapshot.self.ready ? "✓ READY" : "READY前"}</strong>
              </article>
              <article className={`player-slot opponent-slot ${snapshot.opponent?.ready ? "is-ready" : ""} ${!snapshot.opponent ? "is-empty" : ""}`}>
                <div className="slot-top"><span className="player-tag opponent-tag">OPP</span><span>{isFakeOpponent ? "TEST" : isHost ? "INVITEE" : "HOST"}</span></div>
                <h2>{opponentName}</h2><p>{isFakeOpponent ? "テスト専用。AtCoderへの接続や提出は行いません。" : snapshot.opponent ? snapshot.opponent.script.hint ?? "AtCoder接続を確認済み" : "招待URLまたはRoom IDを共有してください"}</p><strong className="ready-state">{snapshot.opponent ? snapshot.opponent.ready ? "✓ READY" : "READY前" : "空席"}</strong>
              </article>
            </section>

            <dl className="match-conditions">
              <div><dt>MODE</dt><dd>BO1</dd></div><div><dt>TIME</dt><dd>{snapshot.settings.limitMinutes}分</dd></div>
              <div><dt>PROBLEM</dt><dd>ABC {snapshot.settings.problemIndexes.join(" / ")} · Difficulty目安 400–1200</dd></div><div><dt>RESULT</dt><dd>サーバーに先着した有効AC</dd></div>
            </dl>

            <div className="waiting-actions">
              <button className="button button-quiet" type="button" disabled={disabled} onClick={connectAtCoder}>{busy === "link-key" ? "接続キーを発行中…" : "AtCoderと接続"}</button>
              <button className={`button ${snapshot.self.ready ? "button-quiet" : "button-primary"}`} type="button" disabled={disabled || (!snapshot.canReady && !snapshot.self.ready)} onClick={() => mutate("ready", { ready: !snapshot.self.ready })}>{snapshot.self.ready ? "READYを解除" : "READYにする"}</button>
              {isHost && <button className="button button-primary" type="button" disabled={disabled || !snapshot.canStart} onClick={() => mutate("start")}>開始する</button>}
              <span className="helper">{snapshot.self.ready ? snapshot.startBlockedReason : snapshot.readyBlockedReason}</span>
            </div>

            <div className="action-row">
              {isHost && snapshot.fakeEvidenceEnabled && !snapshot.opponent && <button className="compact-button" type="button" disabled={disabled} onClick={() => void mutate("fake-opponent")}>{busy === "fake-opponent" ? "追加中…" : "テスト相手を追加"}</button>}
              {isHost && snapshot.opponent && <button className="compact-button" type="button" disabled={disabled || !snapshot.canReleaseInviteeSeat} onClick={() => { if (window.confirm(isFakeOpponent ? "テスト相手を外しますか？" : "Inviteeの席を空けますか？ 相手は同じ参加者キーで戻れなくなります。")) void mutate("leave", { action: "release_invitee_seat" }); }}>{isFakeOpponent ? "テスト相手を外す" : "Inviteeの席を空ける"}</button>}
              {isHost
                ? <button className="compact-button" type="button" disabled={disabled} onClick={() => { if (window.confirm("このRoomを閉じますか？ 相手もRoomへ戻れなくなります。")) void mutate("leave", { action: "close_room" }); }}>Roomを閉じる</button>
                : <button className="compact-button" type="button" disabled={disabled} onClick={() => void leaveInviteeSeat()}>Roomから退出</button>}
            </div>
          </main>
        )}

        {(snapshot.view === "countdown" || startHoldActive) && (
          <main className="countdown-main">
            <p className="kicker">MATCH STARTS IN</p><div className="countdown-number" aria-live="assertive">{countdown || "START"}</div><p>{startHoldActive ? "対戦を開始します。問題を表示しています。" : "問題はまだ非公開です。START後にAtCoderへのリンクが表示されます。"}</p>
            {snapshot.view === "countdown" && <button className="button button-quiet" type="button" disabled={disabled} onClick={() => mutate("cancel-start")}>準備に戻る</button>}
          </main>
        )}

        {!startHoldActive && (snapshot.view === "live" || snapshot.view === "awaiting_judge" || snapshot.view === "decided") && match && (
          <>
            <main className="live-main" inert={snapshot.view === "decided"} aria-hidden={snapshot.view === "decided"}>
              <section className="match-hud" aria-label="対戦状況">
                <div className="hud-player hud-self"><span className="player-badge">YOU</span><div><strong>{snapshot.self.atcoderId}</strong><small>提出 {snapshot.self.submissionCount}回 · ミス {snapshot.self.missCount}回</small></div>{selfLatest && <VerdictBadge verdict={selfLatest.verdict} />}</div>
                <div className="hud-timer"><span>{snapshot.view === "awaiting_judge" ? "最終判定を確認中" : "REMAINING"}</span><strong>{formatClock(remaining)}</strong><progress max={snapshot.settings.limitMinutes * 60} value={remaining}>残り{formatClock(remaining)}</progress></div>
                <div className="hud-player hud-opponent">{match.opponent.latestVerdict && <VerdictBadge verdict={match.opponent.latestVerdict} />}<div><strong>{opponentName}</strong><small>提出 {match.opponent.submissionCount}回 · 判定待ち {match.opponent.pendingCount}件</small></div><span className="player-badge opponent-badge">OPP</span></div>
              </section>

              <div className="battle-body">
                <div className="battle-primary">
                  {match.problem ? <article className="problem-card">
                    <div className="problem-top"><span className="kicker">PROBLEM</span><span className="problem-id">{match.problem.contestId.toUpperCase()} {match.problem.problemIndex}</span><span className="fine-print">問題文はAtCoder上で読んでください</span></div><h1>{match.problem.title}</h1>
                    <div className="problem-meta">{match.problem.difficulty !== null && <span className="difficulty"><i aria-hidden="true" /> Difficulty目安 {match.problem.difficulty}</span>}<span>抽選 / ABC C・D</span></div>
                    <div className="problem-actions"><a className="button button-primary" href={match.problem.url} target="_blank" rel="noopener noreferrer">AtCoderで問題を開く <span aria-hidden="true">↗</span></a><a className="button" href={match.problem.submitUrl} target="_blank" rel="noopener noreferrer">提出ページを開く <span aria-hidden="true">↗</span></a></div><p className="polling-note">提出後はuserscriptが自動で判定を送ります。この画面で更新操作は不要です。<span>1秒ごとに同期</span></p>
                  </article> : <p className="status-banner">START時刻を同期しています。問題はまもなく表示されます。</p>}

                  <section className="submission-section" id="submission-log">
                    <div className="section-heading"><h2>自分の提出（{selfSubmissions.length}）</h2><span className="section-note">時間ペナルティなし</span></div>
                    <div className="submission-table" role="table" aria-label="自分の提出履歴"><div className="submission-head" role="row"><span>#</span><span>判定</span><span>言語</span><span>経過</span></div>{[...selfSubmissions].reverse().map((submission) => <div className="submission-row" role="row" key={`${submission.submissionId}-${submission.status}`}><span>{submission.submissionId}</span><VerdictBadge verdict={submission.verdict} /><span>{submission.language ?? "—"}</span><time>{elapsed(submission, match.startsAt)}</time></div>)}</div>
                  </section>
                </div>

                <aside className="battle-sidebar">
                  <section className="opponent-panel"><div className="opponent-title"><span className="opponent-light" aria-hidden="true" /><strong>{opponentName}</strong><span>{isFakeOpponent ? "TEST OPPONENT" : "OPPONENT"}</span></div><dl className="opponent-stats"><div><dt>提出</dt><dd>{match.opponent.submissionCount}</dd></div><div><dt>ミス</dt><dd>{match.opponent.missCount}</dd></div><div><dt>待ち</dt><dd>{match.opponent.pendingCount}</dd></div></dl><p className="fine-print">{isFakeOpponent ? "テスト相手は提出しません。あなたの実提出の判定経路を確認できます。" : "対戦中は相手の正確な提出時刻と言語を表示しません。"}</p></section>
                  {snapshot.fakeEvidenceEnabled && snapshot.view !== "decided" && <details className="demo-controls"><summary>デモ操作</summary><p>自分のFake提出だけを送ります。実際の勝敗と同じくサーバーが確定します。</p><div className="demo-verdicts"><button className="compact-button" type="button" disabled={disabled} onClick={() => fakeSubmission("pending")}>WJ</button>{["WA", "TLE", "RE", "AC"].map((verdict) => <button className="compact-button" type="button" disabled={disabled} key={verdict} onClick={() => fakeSubmission("final", verdict)}>{verdict}</button>)}</div></details>}
                  {snapshot.canForfeit && <section className="forfeit-block"><h2>対戦を終了する</h2><p>棄権すると相手の勝利として結果に残ります。</p><button className="button button-danger" type="button" disabled={disabled} onClick={() => forfeitDialog.current?.showModal()}>棄権する</button></section>}
                </aside>
              </div>
            </main>

            {snapshot.view === "decided" && match.result && (
              <div className="result-overlay" role="dialog" aria-modal="true" aria-labelledby="result-title" aria-describedby="result-summary">
                <div className={`result-overlay-card result-${resultLabel.toLowerCase()}`}>
                  <div className="result-mark" aria-hidden="true" />
                  <strong id="result-title">{resultLabel}</strong>
                  <p id="result-summary">{match.result.detail ?? (resultLabel === "WIN" ? "あなたのACを先に受理しました。" : resultLabel === "LOSE" ? "相手のACを先に受理しました。" : "Matchの結果が確定しました。")}</p>
                  {match.persistence !== "saved" && <span className="helper">結果をPostgreSQLへ保存中です。</span>}
                  <div className="action-row">
                    <Link autoFocus className="button button-primary" href={match.result.matchPath}>結果を見る</Link>
                    {snapshot.rematch.available && (snapshot.rematch.requestedBy && snapshot.rematch.requestedBy !== snapshot.viewerSeat
                      ? <button className="button button-quiet" type="button" onClick={() => mutate("rematch", { action: "accept" })}>再戦を承認</button>
                      : <button className="button button-quiet" type="button" onClick={() => mutate("rematch", { action: "request" })}>再戦を申し込む</button>)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <dialog className="confirm-dialog" ref={forfeitDialog} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <form method="dialog"><p className="kicker">FORFEIT</p><h2>このMatchを棄権しますか？</h2><p>棄権を確定すると、相手の勝利として保存されます。この操作は取り消せません。</p><div className="action-row"><button className="button button-quiet" value="cancel">対戦を続ける</button><button className="button button-danger" value="confirm" onClick={() => void mutate("forfeit", { confirmed: true })}>棄権を確定</button></div></form>
      </dialog>
    </>
  );
}
