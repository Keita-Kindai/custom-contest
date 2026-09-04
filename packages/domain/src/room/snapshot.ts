import {
  OPPONENT_SEAT,
  type MatchView,
  type OpponentSubmissionSummary,
  type ParticipantView,
  type RoomSnapshot,
  type RoomView,
  type Seat,
  type SubmissionEntry,
} from "@custom-contest/contracts";
import {
  appConnected,
  rematchBlockReason,
  readyBlockReason,
  scriptFresh,
  scriptIdMatched,
  startBlockReason,
} from "./commands";
import {
  isMatchRunning,
  type MatchState,
  type ParticipantState,
  type RoomState,
  type SubmissionRecord,
} from "./state";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function countsFor(match: MatchState | null, seat: Seat) {
  if (!match) return { submissionCount: 0, missCount: 0, pendingCount: 0, latestVerdict: null };
  const mine = match.submissions.filter((record) => record.seat === seat);
  const finals = mine.filter((record) => record.status === "final");
  const latest = [...finals].sort((a, b) => a.receivedAt - b.receivedAt).at(-1) ?? null;
  return {
    submissionCount: mine.length,
    missCount: finals.filter((record) => record.verdict !== "AC").length,
    pendingCount: mine.filter((record) => record.status === "pending").length,
    latestVerdict: latest?.verdict ?? null,
  };
}

function toParticipantView(
  room: RoomState,
  participant: ParticipantState,
  now: number,
): ParticipantView {
  const script = participant.script;
  const fresh = scriptFresh(participant, now);
  const idMatched = scriptIdMatched(participant);
  const counts = countsFor(room.match, participant.seat);
  let hint: string | null = null;
  if (!script) hint = "AtCoderと接続してください。";
  else if (!fresh) hint = "AtCoderの接続確認が15秒以上届いていません。";
  else if (!script.loggedIn) hint = "AtCoderへログインしてください。";
  else if (!idMatched) hint = "IDが一致しません。";
  else if (!script.judgeReachable) hint = "判定を確認できません。";

  return {
    seat: participant.seat,
    atcoderId: participant.atcoderId,
    ready: participant.ready,
    appConnected: appConnected(participant, now),
    script: {
      linked: script !== null,
      loggedIn: script?.loggedIn ?? false,
      idMatched,
      judgeReachable: script?.judgeReachable ?? false,
      fresh,
      lastHeartbeatAt: script ? iso(script.lastHeartbeatAt) : null,
      hint,
    },
    submissionCount: counts.submissionCount,
    missCount: counts.missCount,
    pendingCount: counts.pendingCount,
    latestVerdict: counts.latestVerdict,
    joinedAt: iso(participant.joinedAt),
  };
}

function toSubmissionEntry(record: SubmissionRecord): SubmissionEntry {
  return {
    submissionId: record.submissionId,
    seat: record.seat,
    atcoderId: record.atcoderId,
    contestId: record.contestId,
    problemId: record.problemId,
    submittedAt: iso(record.submittedAt),
    receivedAt: iso(record.receivedAt),
    status: record.status,
    verdict: record.verdict,
    language: record.language,
    source: record.source,
    late: record.late,
  };
}

function toOpponentSummary(match: MatchState | null, seat: Seat): OpponentSubmissionSummary {
  const counts = countsFor(match, seat);
  return {
    submissionCount: counts.submissionCount,
    missCount: counts.missCount,
    pendingCount: counts.pendingCount,
    latestVerdict: counts.latestVerdict,
  };
}

function matchPath(matchId: string): string {
  return `/battle/m/${matchId}`;
}

function toMatchView(room: RoomState, match: MatchState, viewerSeat: Seat, now: number): MatchView {
  const decided = match.phase === "decided";
  // 問題はSTART時刻より前に配信しない。
  const problem = now >= match.startsAt ? match.problem : null;
  const opponentSeat = OPPONENT_SEAT[viewerSeat];
  const visible = decided
    ? match.submissions
    : match.submissions.filter((record) => record.seat === viewerSeat);

  const persistenceMessage =
    match.persistence.state === "pending"
      ? "結果を保存中です。保存できるまで再戦できません。"
      : null;

  return {
    matchId: match.matchId,
    roundIndex: 1,
    phase: match.phase,
    seed: match.seed,
    startsAt: iso(match.startsAt),
    deadlineAt: iso(match.deadlineAt),
    graceUntil: match.graceUntil === null ? null : iso(match.graceUntil),
    problem,
    submissions: [...visible]
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .map(toSubmissionEntry),
    opponent: toOpponentSummary(match, opponentSeat),
    result: match.result
      ? {
          outcome: match.result.outcome,
          winnerSeat: match.result.winnerSeat,
          reason: match.result.reason,
          decidedAt: iso(match.result.decidedAt),
          detail: match.result.detail,
          matchPath: matchPath(match.matchId),
          verificationLabel: "userscript確認・カジュアル対戦",
        }
      : null,
    persistence: match.persistence.state,
    persistenceMessage,
  };
}

function viewOf(room: RoomState): RoomView {
  if (room.closed) return "closed";
  if (!room.match) return "waiting";
  return room.match.phase;
}

export function buildSnapshot(
  room: RoomState,
  viewerSeat: Seat,
  now: number,
  options: { fakeEvidenceEnabled: boolean },
): RoomSnapshot {
  const self = room.participants[viewerSeat];
  if (!self) throw new Error(`seat ${viewerSeat} is not occupied`);
  const opponent = room.participants[OPPONENT_SEAT[viewerSeat]];

  const readyBlocked = readyBlockReason(room, self, now);
  const startBlocked = startBlockReason(room, viewerSeat, now);
  const rematchBlocked = rematchBlockReason(room);

  return {
    roomId: room.roomId,
    revision: room.revision,
    serverTime: iso(now),
    view: viewOf(room),
    settings: room.settings,
    viewerSeat,
    self: toParticipantView(room, self, now),
    opponent: opponent ? toParticipantView(room, opponent, now) : null,
    match: room.match ? toMatchView(room, room.match, viewerSeat, now) : null,
    rematch: {
      requestedBy: room.rematch?.requestedBy ?? null,
      requestedAt: room.rematch ? iso(room.rematch.requestedAt) : null,
      available: rematchBlocked === null,
      blockedReason: rematchBlocked,
    },
    canReady: readyBlocked === null,
    readyBlockedReason: readyBlocked,
    canStart: viewerSeat === "host" && startBlocked === null,
    startBlockedReason: viewerSeat === "host" ? startBlocked : "開始できるのはホストだけです。",
    canForfeit: isMatchRunning(room) && room.match?.phase !== "countdown",
    canReleaseInviteeSeat:
      viewerSeat === "host" && !room.closed && opponent !== null && !isMatchRunning(room),
    closed: room.closed,
    closedReason: room.closedReason,
    notices: self.notices.map((notice) => ({
      id: notice.id,
      level: notice.level,
      message: notice.message,
      fix: notice.fix,
      at: iso(notice.at),
    })),
    fakeEvidenceEnabled: options.fakeEvidenceEnabled,
    finishedMatches: room.finishedMatches.map((entry) => ({
      matchId: entry.matchId,
      matchPath: matchPath(entry.matchId),
      outcome: entry.outcome,
      winnerSeat: entry.winnerSeat,
      decidedAt: iso(entry.decidedAt),
    })),
  };
}

export { matchPath };
