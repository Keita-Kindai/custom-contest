import type {
  EvidenceSource,
  MatchPhase,
  MatchReason,
  MatchOutcome,
  Problem,
  RoomClosedReason,
  RoomSettings,
  Seat,
} from "@custom-contest/contracts";

/** 本人にだけ見せる通知。Submission evidenceの拒否理由など。 */
export type ParticipantNotice = {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
  fix: string | null;
  at: number;
};

export type ScriptLinkState = {
  token: string;
  linkedAt: number;
  scriptVersion: string;
  lastHeartbeatAt: number;
  loggedIn: boolean;
  loginAtcoderId: string | null;
  judgeReachable: boolean;
  healthCheckedAt: number;
};

export type PendingLinkKey = {
  linkKey: string;
  issuedAt: number;
  expiresAt: number;
};

export type ParticipantState = {
  seat: Seat;
  participantKey: string;
  atcoderId: string;
  ready: boolean;
  joinedAt: number;
  /** 直近のRoom snapshot取得時刻。切断でも席は残す。 */
  lastSeenAt: number;
  script: ScriptLinkState | null;
  pendingLinkKey: PendingLinkKey | null;
  notices: ParticipantNotice[];
};

export type SubmissionRecord = {
  submissionId: number;
  seat: Seat;
  atcoderId: string;
  contestId: string;
  problemId: string;
  submittedAt: number;
  receivedAt: number;
  status: "pending" | "final";
  verdict: string | null;
  language: string | null;
  source: EvidenceSource;
  /** 勝敗確定後に到着した有効な提出。結果は変更しない。 */
  late: boolean;
};

export type MatchResultState = {
  outcome: MatchOutcome;
  winnerSeat: Seat | null;
  reason: MatchReason;
  decidedAt: number;
  detail: string | null;
};

export type PersistenceState = {
  state: "not_required" | "pending" | "saved";
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
};

export type MatchState = {
  matchId: string;
  roundIndex: 1;
  seed: string;
  problem: Problem;
  /** 席が後で解放されても結果を保存できる、開始時点の参加者。 */
  participants: { hostAtcoderId: string; inviteeAtcoderId: string };
  createdAt: number;
  /** countdown終了 = START時刻。 */
  startsAt: number;
  deadlineAt: number;
  /** awaiting_judgeの期限。制限時間切れ + 5分。 */
  graceUntil: number | null;
  phase: MatchPhase;
  submissions: SubmissionRecord[];
  result: MatchResultState | null;
  persistence: PersistenceState;
};

export type FinishedMatchSummary = {
  matchId: string;
  outcome: MatchOutcome;
  winnerSeat: Seat | null;
  decidedAt: number;
};

export type RoomState = {
  roomId: string;
  createdAt: number;
  settings: RoomSettings;
  participants: { host: ParticipantState | null; invitee: ParticipantState | null };
  match: MatchState | null;
  /** 再戦後も遅着evidenceと保存retryを受けられる、完了済みMatchのprocess内実体。 */
  archivedMatches: MatchState[];
  /** このRoomで出題済みの問題。使い切るまで重複させない。 */
  usedProblemIds: string[];
  /** START前に利用不能と判明した問題。 */
  unavailableProblemIds: string[];
  rematch: { requestedBy: Seat; requestedAt: number } | null;
  finishedMatches: FinishedMatchSummary[];
  closed: boolean;
  closedReason: RoomClosedReason | null;
  revision: number;
  lastActivityAt: number;
};

export function participantBySeat(room: RoomState, seat: Seat): ParticipantState | null {
  return room.participants[seat];
}

export function findByParticipantKey(
  room: RoomState,
  participantKey: string,
): ParticipantState | null {
  const { host, invitee } = room.participants;
  if (host && host.participantKey === participantKey) return host;
  if (invitee && invitee.participantKey === participantKey) return invitee;
  return null;
}

export function findByScriptToken(room: RoomState, token: string): ParticipantState | null {
  const { host, invitee } = room.participants;
  if (host?.script?.token === token) return host;
  if (invitee?.script?.token === token) return invitee;
  return null;
}

export function bothParticipants(room: RoomState): ParticipantState[] {
  return [room.participants.host, room.participants.invitee].filter(
    (participant): participant is ParticipantState => participant !== null,
  );
}

/** Matchが進行中（countdown・live・awaiting_judge）か。 */
export function isMatchRunning(room: RoomState): boolean {
  return room.match !== null && room.match.phase !== "decided";
}

export function findMatch(room: RoomState, matchId: string): MatchState | null {
  if (room.match?.matchId === matchId) return room.match;
  return room.archivedMatches.find((match) => match.matchId === matchId) ?? null;
}

export function allMatches(room: RoomState): MatchState[] {
  return room.match ? [room.match, ...room.archivedMatches] : [...room.archivedMatches];
}
