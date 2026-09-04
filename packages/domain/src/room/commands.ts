import {
  APP_CONNECTION_TIMEOUT_MS,
  COUNTDOWN_MS,
  IDLE_ROOM_TIMEOUT_MS,
  LINK_KEY_TTL_MS,
  OPPONENT_SEAT,
  OUTBOX_RETENTION_AFTER_MATCH_MS,
  PENDING_GRACE_MS,
  SCRIPT_HEALTH_FRESHNESS_MS,
  isAcceptedVerdict,
  type ApiErrorCode,
  type EvidenceRejectionCode,
  type MatchReason,
  type RoomSettings,
  type Seat,
  type SubmissionEvidence,
} from "@custom-contest/contracts";
import { selectProblem } from "../problem-pool";
import {
  newLinkKey,
  newMatchId,
  newParticipantKey,
  newScriptToken,
  newSeed,
  randomHex,
  type RandomSource,
} from "../random";
import {
  bothParticipants,
  findMatch,
  findByParticipantKey,
  findByScriptToken,
  isMatchRunning,
  type MatchState,
  type ParticipantNotice,
  type ParticipantState,
  type RoomState,
  type SubmissionRecord,
} from "./state";

export type CommandContext = {
  now: number;
  random: RandomSource;
  /** Fake提出の受付。development / test / 明示したdemo設定だけでtrue。 */
  fakeEvidenceEnabled: boolean;
};

export type Failure = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  fix: string | null;
};

export type Success<T extends object = object> = { ok: true } & T;
export type Result<T extends object = object> = Success<T> | Failure;

function fail(code: ApiErrorCode, message: string, fix: string | null = null): Failure {
  return { ok: false, code, message, fix };
}

const MAX_NOTICES = 6;

function bump(room: RoomState, now: number): void {
  room.revision += 1;
  room.lastActivityAt = now;
}

function addNotice(participant: ParticipantState, notice: Omit<ParticipantNotice, "id">, id: string): void {
  participant.notices = [...participant.notices, { ...notice, id }].slice(-MAX_NOTICES);
}

// --- Room作成と参加 -----------------------------------------------------------

export function createRoom(
  settings: RoomSettings,
  hostAtcoderId: string,
  ctx: CommandContext,
  roomId: string,
): { room: RoomState; participant: ParticipantState } {
  const host: ParticipantState = {
    seat: "host",
    participantKey: newParticipantKey(ctx.random),
    atcoderId: hostAtcoderId,
    ready: false,
    joinedAt: ctx.now,
    lastSeenAt: ctx.now,
    script: null,
    pendingLinkKey: null,
    notices: [],
  };
  const room: RoomState = {
    roomId,
    createdAt: ctx.now,
    settings,
    participants: { host, invitee: null },
    match: null,
    archivedMatches: [],
    usedProblemIds: [],
    unavailableProblemIds: [],
    rematch: null,
    finishedMatches: [],
    closed: false,
    closedReason: null,
    revision: 1,
    lastActivityAt: ctx.now,
  };
  return { room, participant: host };
}

export function joinRoom(
  room: RoomState,
  input: { atcoderId: string; participantKey?: string },
  ctx: CommandContext,
): Result<{ participant: ParticipantState }> {
  if (room.closed) {
    return fail("room_closed", "このRoomは終了しています。", "新しいRoomを作るか、招待し直してもらってください。");
  }

  if (input.participantKey) {
    const existing = findByParticipantKey(room, input.participantKey);
    if (existing) {
      if (existing.atcoderId !== input.atcoderId) {
        return fail(
          "forbidden",
          "この席のAtCoder IDと入力が一致しません。",
          `席は ${existing.atcoderId} として登録されています。プロフィールのIDを戻してください。`,
        );
      }
      existing.lastSeenAt = ctx.now;
      bump(room, ctx.now);
      return { ok: true, participant: existing };
    }
  }

  const host = room.participants.host;
  if (host && host.atcoderId === input.atcoderId) {
    return fail(
      "duplicate_atcoder_id",
      "同じAtCoder IDの2人は同じRoomへ参加できません。",
      "別のAtCoder IDをプロフィールへ設定してください。",
    );
  }
  if (room.participants.invitee) {
    return fail("room_full", "このRoomの席は埋まっています。", "ホストへ席を空けてもらってください。");
  }

  const invitee: ParticipantState = {
    seat: "invitee",
    participantKey: newParticipantKey(ctx.random),
    atcoderId: input.atcoderId,
    ready: false,
    joinedAt: ctx.now,
    lastSeenAt: ctx.now,
    script: null,
    pendingLinkKey: null,
    notices: [],
  };
  room.participants.invitee = invitee;
  bump(room, ctx.now);
  return { ok: true, participant: invitee };
}

/** snapshot取得のたびに呼び、在室表示を更新する。 */
export function touch(room: RoomState, participant: ParticipantState, now: number): void {
  participant.lastSeenAt = now;
  if (now > room.lastActivityAt) room.lastActivityAt = now;
}

export function appConnected(participant: ParticipantState, now: number): boolean {
  return now - participant.lastSeenAt <= APP_CONNECTION_TIMEOUT_MS * 2;
}

// --- userscript接続 -----------------------------------------------------------

export function scriptFresh(participant: ParticipantState, now: number): boolean {
  const script = participant.script;
  if (!script) return false;
  return now - script.healthCheckedAt <= SCRIPT_HEALTH_FRESHNESS_MS;
}

export function scriptIdMatched(participant: ParticipantState): boolean {
  const script = participant.script;
  if (!script) return false;
  return script.loginAtcoderId !== null && script.loginAtcoderId === participant.atcoderId;
}

/** READYを許可できない理由。許可できる場合はnull。 */
export function readyBlockReason(
  room: RoomState,
  participant: ParticipantState,
  now: number,
): string | null {
  if (room.closed) return "このRoomは終了しています。";
  if (isMatchRunning(room)) return "対戦中はREADYを変更できません。";
  if (room.match?.phase === "decided" && room.match.persistence.state !== "saved") {
    return "結果を保存中です。保存が終わるまでお待ちください。";
  }
  const opponent = room.participants[OPPONENT_SEAT[participant.seat]];
  if (!opponent) return "相手の参加を待っています。招待URLまたはRoom IDを共有してください。";
  const script = participant.script;
  if (!script) return "AtCoderと接続してください。「AtCoderと接続」からuserscriptを紐づけます。";
  if (!scriptFresh(participant, now)) {
    return "AtCoderの接続確認が15秒以上届いていません。AtCoderのタブを開いたままにしてください。";
  }
  if (!script.loggedIn) return "AtCoderへログインしてください。";
  if (!scriptIdMatched(participant)) {
    return `IDが一致しません。プロフィールは ${participant.atcoderId}、AtCoderのログインは ${script.loginAtcoderId ?? "不明"} です。`;
  }
  if (!script.judgeReachable) {
    return "判定を確認できません。AtCoderの提出一覧を開けるか確認してください。";
  }
  return null;
}

export function issueLinkKey(
  room: RoomState,
  participantKey: string,
  ctx: CommandContext,
): Result<{ participant: ParticipantState; linkKey: string; expiresAt: number }> {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");
  if (room.closed) return fail("room_closed", "このRoomは終了しています。", null);

  const linkKey = newLinkKey(ctx.random);
  participant.pendingLinkKey = {
    linkKey,
    issuedAt: ctx.now,
    expiresAt: ctx.now + LINK_KEY_TTL_MS,
  };
  bump(room, ctx.now);
  return { ok: true, participant, linkKey, expiresAt: participant.pendingLinkKey.expiresAt };
}

export function linkScript(
  room: RoomState,
  input: { linkKey: string; loginAtcoderId: string | null; scriptVersion: string },
  ctx: CommandContext,
): Result<{ participant: ParticipantState; scriptToken: string }> {
  if (room.closed) return fail("room_closed", "このRoomは終了しています。", null);

  const participant = bothParticipants(room).find(
    (candidate) => candidate.pendingLinkKey?.linkKey === input.linkKey,
  );
  if (!participant || !participant.pendingLinkKey) {
    return fail(
      "link_key_invalid",
      "接続キーを確認できません。",
      "Room画面で「AtCoderと接続」をもう一度実行してください。",
    );
  }
  if (ctx.now > participant.pendingLinkKey.expiresAt) {
    participant.pendingLinkKey = null;
    return fail(
      "link_key_expired",
      "接続キーの有効期限（5分）が切れています。",
      "Room画面で「AtCoderと接続」をもう一度実行してください。",
    );
  }

  // 一回限り。交換した時点で無効化し、古い専用tokenも切る。
  participant.pendingLinkKey = null;
  const scriptToken = newScriptToken(ctx.random);
  participant.script = {
    token: scriptToken,
    linkedAt: ctx.now,
    scriptVersion: input.scriptVersion,
    lastHeartbeatAt: ctx.now,
    loggedIn: input.loginAtcoderId !== null,
    loginAtcoderId: input.loginAtcoderId,
    judgeReachable: false,
    healthCheckedAt: ctx.now,
  };
  bump(room, ctx.now);
  return { ok: true, participant, scriptToken };
}

export function heartbeat(
  room: RoomState,
  input: {
    scriptToken: string;
    loggedIn: boolean;
    loginAtcoderId: string | null;
    judgeReachable: boolean;
    checkedAt: number;
  },
  ctx: CommandContext,
): Result<{ participant: ParticipantState }> {
  const participant = findByScriptToken(room, input.scriptToken);
  if (!participant || !participant.script) {
    return fail(
      "script_token_invalid",
      "userscriptの接続が無効になっています。",
      "Room画面で「AtCoderと接続」をやり直してください。",
    );
  }
  const script = participant.script;
  script.lastHeartbeatAt = ctx.now;
  script.loggedIn = input.loggedIn;
  script.loginAtcoderId = input.loginAtcoderId;
  script.judgeReachable = input.judgeReachable;
  // 未来の時刻を送られてもfreshness判定を伸ばさない。
  script.healthCheckedAt = Math.min(input.checkedAt, ctx.now);
  bump(room, ctx.now);
  return { ok: true, participant };
}

// --- READY / START / 中止 ------------------------------------------------------

export function setReady(
  room: RoomState,
  participantKey: string,
  ready: boolean,
  ctx: CommandContext,
): Result<{ participant: ParticipantState }> {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");

  if (room.match?.phase === "countdown") {
    return fail("invalid_state", "カウントダウン中はREADYを変更できません。", "「準備に戻る」で中止できます。");
  }
  if (ready) {
    const blocked = readyBlockReason(room, participant, ctx.now);
    if (blocked) return fail("ready_blocked", blocked, null);
  }
  participant.ready = ready;
  bump(room, ctx.now);
  return { ok: true, participant };
}

/** 開始を許可できない理由。許可できる場合はnull。 */
export function startBlockReason(room: RoomState, seat: Seat, now: number): string | null {
  if (seat !== "host") return "開始できるのはホストだけです。";
  if (room.closed) return "このRoomは終了しています。";
  if (isMatchRunning(room)) return "すでに対戦が進行中です。";
  if (room.match?.phase === "decided" && room.match.persistence.state !== "saved") {
    return "結果を保存中です。保存が終わると再戦できます。";
  }
  if (room.match?.phase === "decided") return "再戦の合意後に開始できます。";
  const host = room.participants.host;
  const invitee = room.participants.invitee;
  if (!host || !invitee) return "相手の参加を待っています。";
  for (const participant of [host, invitee]) {
    if (!participant.ready) return "両者のREADYを待っています。";
    const blocked = readyBlockReason(room, participant, now);
    if (blocked) {
      return participant.seat === "host"
        ? `自分の接続を確認してください。${blocked}`
        : "相手のAtCoder接続を確認中です。";
    }
  }
  return null;
}

export function startMatch(
  room: RoomState,
  participantKey: string,
  ctx: CommandContext,
): Result<{ match: MatchState }> {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");
  if (participant.seat !== "host") return fail("not_host", "開始できるのはホストだけです。", null);

  const blocked = startBlockReason(room, participant.seat, ctx.now);
  if (blocked) return fail("start_blocked", blocked, null);

  const seed = newSeed(ctx.random);
  const selection = selectProblem(room.settings, room.usedProblemIds, seed, room.unavailableProblemIds);
  if (!selection.ok) {
    return fail(
      "problem_pool_empty",
      "出題できる問題が残っていません。",
      "出題する問題記号を増やすか、新しいRoomを作ってください。",
    );
  }
  if (selection.resetUsed) room.usedProblemIds = [];

  const startsAt = ctx.now + COUNTDOWN_MS;
  const host = room.participants.host;
  const invitee = room.participants.invitee;
  if (!host || !invitee) {
    return fail("start_blocked", "相手の参加を待っています。", null);
  }
  const match: MatchState = {
    matchId: newMatchId(ctx.random),
    roundIndex: 1,
    seed,
    problem: selection.problem,
    participants: {
      hostAtcoderId: host.atcoderId,
      inviteeAtcoderId: invitee.atcoderId,
    },
    createdAt: ctx.now,
    startsAt,
    deadlineAt: startsAt + room.settings.limitMinutes * 60_000,
    graceUntil: null,
    phase: "countdown",
    submissions: [],
    result: null,
    persistence: { state: "not_required", attempts: 0, lastAttemptAt: null, lastError: null },
  };
  room.match = match;
  room.usedProblemIds = [...room.usedProblemIds, selection.problem.problemId];
  room.rematch = null;
  bump(room, ctx.now);
  return { ok: true, match };
}

export function cancelStart(room: RoomState, participantKey: string, ctx: CommandContext): Result {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");
  if (!room.match || room.match.phase !== "countdown") {
    return fail("invalid_state", "カウントダウン中だけ中止できます。", null);
  }
  // 出題済み扱いにしない。中止したMatchは残さない。
  room.usedProblemIds = room.usedProblemIds.filter((id) => id !== room.match?.problem.problemId);
  room.match = null;
  for (const each of bothParticipants(room)) each.ready = false;
  bump(room, ctx.now);
  return { ok: true };
}

// --- 結果確定 -------------------------------------------------------------------

function decide(
  room: RoomState,
  match: MatchState,
  outcome: "win" | "draw" | "void",
  winnerSeat: Seat | null,
  reason: MatchReason,
  detail: string | null,
  now: number,
): void {
  match.phase = "decided";
  match.graceUntil = null;
  match.result = { outcome, winnerSeat, reason, decidedAt: now, detail };
  match.persistence = { state: "pending", attempts: 0, lastAttemptAt: null, lastError: null };
  room.finishedMatches = [
    { matchId: match.matchId, outcome, winnerSeat, decidedAt: now },
    ...room.finishedMatches,
  ].slice(0, 20);
  room.rematch = null;
  for (const participant of bothParticipants(room)) participant.ready = false;
  bump(room, now);
}

export function forfeit(room: RoomState, participantKey: string, ctx: CommandContext): Result {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");
  const match = room.match;
  if (!match || match.phase === "decided") {
    return fail("invalid_state", "対戦中だけ棄権できます。", null);
  }
  if (match.phase === "countdown") {
    return fail("invalid_state", "カウントダウン中は「準備に戻る」で中止してください。", null);
  }
  const winner = OPPONENT_SEAT[participant.seat];
  decide(room, match, "win", winner, "forfeit", `${participant.atcoderId} が棄権しました。`, ctx.now);
  return { ok: true };
}

/** START後に問題を開けないと分かった場合。原因付きVOIDにして同条件で再戦できるようにする。 */
export function reportProblemUnavailable(
  room: RoomState,
  participantKey: string,
  detail: string,
  ctx: CommandContext,
): Result {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");
  const match = room.match;
  if (!match || match.phase === "decided") return fail("invalid_state", "対戦中だけ報告できます。", null);
  if (match.phase === "countdown") {
    // START前なら別問題を再抽選する。
    room.unavailableProblemIds = [...room.unavailableProblemIds, match.problem.problemId];
    room.usedProblemIds = room.usedProblemIds.filter((id) => id !== match.problem.problemId);
    const seed = newSeed(ctx.random);
    const selection = selectProblem(room.settings, room.usedProblemIds, seed, room.unavailableProblemIds);
    if (!selection.ok) {
      return fail("problem_pool_empty", "出題できる問題が残っていません。", "新しいRoomを作ってください。");
    }
    match.seed = seed;
    match.problem = selection.problem;
    room.usedProblemIds = [...room.usedProblemIds, selection.problem.problemId];
    bump(room, ctx.now);
    return { ok: true };
  }
  room.unavailableProblemIds = [...room.unavailableProblemIds, match.problem.problemId];
  decide(room, match, "void", null, "void_problem_unavailable", detail, ctx.now);
  return { ok: true };
}

// --- Submission evidence --------------------------------------------------------

/** Submission evidenceのdomain表現。時刻はepoch msへ正規化してから渡す。 */
export type EvidenceInput = Omit<SubmissionEvidence, "submittedAt"> & { submittedAt: number };

export type EvidenceOutcome =
  | { submissionId: number; accepted: true }
  | { submissionId: number; accepted: false; code: EvidenceRejectionCode; message: string; fix: string | null };

function pendingRecords(match: MatchState): SubmissionRecord[] {
  return match.submissions.filter((record) => record.status === "pending");
}

function rejection(
  submissionId: number,
  code: EvidenceRejectionCode,
  message: string,
  fix: string | null,
): EvidenceOutcome {
  return { submissionId, accepted: false, code, message, fix };
}

function applyOne(
  room: RoomState,
  match: MatchState,
  participant: ParticipantState,
  evidence: EvidenceInput,
  ctx: CommandContext,
): EvidenceOutcome {
  if (evidence.source === "fake" && !ctx.fakeEvidenceEnabled) {
    return rejection(
      evidence.submissionId,
      "fake_disabled",
      "Fake判定はこのサーバーでは受け付けていません。",
      "実際のAtCoder提出を使ってください。",
    );
  }
  if (evidence.atcoderId !== participant.atcoderId) {
    return rejection(
      evidence.submissionId,
      "atcoder_id_mismatch",
      "提出者とプロフィールのAtCoder IDが一致しません。",
      `プロフィールは ${participant.atcoderId} です。AtCoderのログインを確認してください。`,
    );
  }
  if (evidence.contestId !== match.problem.contestId || evidence.problemId !== match.problem.problemId) {
    return rejection(
      evidence.submissionId,
      "wrong_problem",
      "この対戦の対象問題ではない提出です。",
      `対象は ${match.problem.contestId} / ${match.problem.problemId} です。`,
    );
  }
  const submittedAt = evidence.submittedAt;
  if (submittedAt < match.startsAt || submittedAt > match.deadlineAt) {
    return rejection(
      evidence.submissionId,
      "outside_time_window",
      "制限時間の外で行われた提出です。",
      "START後、制限時間内の提出だけが対象です。",
    );
  }
  if (match.phase === "countdown") {
    return rejection(
      evidence.submissionId,
      "match_not_running",
      "対戦がまだ始まっていません。",
      "STARTの表示後に提出してください。",
    );
  }
  if (
    match.phase === "decided" &&
    match.result !== null &&
    ctx.now > match.result.decidedAt + OUTBOX_RETENTION_AFTER_MATCH_MS
  ) {
    return rejection(
      evidence.submissionId,
      "match_not_running",
      "結果確定から5分を過ぎた通知は受付を終了しました。",
      "この通知は再送せず、次のMatchを監視してください。",
    );
  }
  if (evidence.status === "final" && evidence.verdict === null) {
    return rejection(evidence.submissionId, "invalid_payload", "確定判定のラベルがありません。", null);
  }

  const existing = match.submissions.find(
    (record) => record.submissionId === evidence.submissionId && record.seat === participant.seat,
  );

  if (existing) {
    // 同じ提出IDの同じ通知は一度だけ処理する。再送はACKだけ返す。
    if (existing.status === "final" || evidence.status === "pending") {
      return { submissionId: evidence.submissionId, accepted: true };
    }
    existing.status = "final";
    existing.verdict = evidence.verdict;
    existing.language = evidence.language ?? existing.language;
    existing.receivedAt = ctx.now;
    existing.late = match.phase === "decided";
  } else {
    match.submissions.push({
      submissionId: evidence.submissionId,
      seat: participant.seat,
      atcoderId: participant.atcoderId,
      contestId: evidence.contestId,
      problemId: evidence.problemId,
      submittedAt,
      receivedAt: ctx.now,
      status: evidence.status,
      verdict: evidence.status === "final" ? evidence.verdict : null,
      language: evidence.language,
      source: evidence.source,
      late: match.phase === "decided",
    });
  }

  // 保存後に届いた有効な遅着もPostgreSQLへ反映する。勝敗そのものは変更しない。
  if (match.phase === "decided" && match.persistence.state === "saved") {
    match.persistence.state = "pending";
  }

  // サーバーが最初に受理した有効ACで即時確定する。後着では結果を変えない。
  if (
    match.phase !== "decided" &&
    evidence.status === "final" &&
    evidence.verdict !== null &&
    isAcceptedVerdict(evidence.verdict)
  ) {
    decide(room, match, "win", participant.seat, "first_ac", null, ctx.now);
    return { submissionId: evidence.submissionId, accepted: true };
  }

  bump(room, ctx.now);
  return { submissionId: evidence.submissionId, accepted: true };
}

export function submitEvidence(
  room: RoomState,
  input: {
    scriptToken?: string;
    participantKey?: string;
    matchId: string;
    submissions: EvidenceInput[];
  },
  ctx: CommandContext,
): Result<{ participant: ParticipantState; outcomes: EvidenceOutcome[] }> {
  const participant = input.scriptToken
    ? findByScriptToken(room, input.scriptToken)
    : input.participantKey
      ? findByParticipantKey(room, input.participantKey)
      : null;
  if (!participant) {
    return input.scriptToken
      ? fail(
          "script_token_invalid",
          "userscriptの接続が無効になっています。",
          "Room画面で「AtCoderと接続」をやり直してください。",
        )
      : fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");
  }

  const match = findMatch(room, input.matchId);
  const outcomes: EvidenceOutcome[] = [];
  if (!match) {
    for (const evidence of input.submissions) {
      outcomes.push(
        rejection(
          evidence.submissionId,
          "unknown_match",
          "対象のMatchが見つかりません。",
          "Room画面を再読み込みしてください。",
        ),
      );
    }
    return { ok: true, participant, outcomes };
  }

  for (const evidence of input.submissions) {
    const outcome = applyOne(room, match, participant, evidence, ctx);
    outcomes.push(outcome);
    if (!outcome.accepted) {
      addNotice(
        participant,
        { level: "error", message: outcome.message, fix: outcome.fix, at: ctx.now },
        `ev_${evidence.submissionId}_${outcome.code}`,
      );
    }
  }

  // 判定待ちが解消していれば、待機を終えて結果を確定する。
  if (room.match?.matchId === match.matchId) resolveAwaitingJudge(room, ctx.now);
  bump(room, ctx.now);
  return { ok: true, participant, outcomes };
}

function resolveAwaitingJudge(room: RoomState, now: number): void {
  const match = room.match;
  if (!match || match.phase !== "awaiting_judge") return;
  if (pendingRecords(match).length === 0) {
    decide(room, match, "draw", null, "timeout_all_non_ac", "時間内の判定待ちが全て非ACで確定しました。", now);
  }
}

// --- 時間の経過 -------------------------------------------------------------------

/** 経過時間だけで起きる状態遷移。snapshot取得やAPI呼び出しの前に必ず実行する。 */
export function tick(room: RoomState, now: number): void {
  const match = room.match;
  if (match) {
    if (match.phase === "countdown" && now >= match.startsAt) {
      match.phase = "live";
      bump(room, now);
    }
    if (match.phase === "live" && now >= match.deadlineAt) {
      if (pendingRecords(match).length > 0) {
        match.phase = "awaiting_judge";
        match.graceUntil = match.deadlineAt + PENDING_GRACE_MS;
        bump(room, now);
      } else {
        decide(room, match, "draw", null, "timeout_no_pending", "制限時間内にACがありませんでした。", now);
      }
    }
    if (match.phase === "awaiting_judge") {
      if (pendingRecords(match).length === 0) {
        decide(room, match, "draw", null, "timeout_all_non_ac", "時間内の判定待ちが全て非ACで確定しました。", now);
      } else if (match.graceUntil !== null && now >= match.graceUntil) {
        decide(
          room,
          match,
          "void",
          null,
          "void_judge_unconfirmed",
          "制限時間切れから5分たっても判定を確認できませんでした。",
          now,
        );
      }
    }
  }

  if (!room.closed && !isMatchRunning(room)) {
    const participants = bothParticipants(room);
    const allDisconnected = participants.every(
      (participant) => now - participant.lastSeenAt >= IDLE_ROOM_TIMEOUT_MS,
    );
    if (participants.length > 0 && allDisconnected) {
      room.closed = true;
      room.closedReason = "idle_timeout";
      bump(room, now);
    }
  }
}

// --- 退出・終了・席の解放 ----------------------------------------------------------

export function leaveRoom(
  room: RoomState,
  participantKey: string,
  action: "leave" | "close_room" | "release_invitee_seat",
  ctx: CommandContext,
): Result {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");

  if (action === "close_room") {
    if (participant.seat !== "host") return fail("not_host", "Roomを閉じられるのはホストだけです。", null);
    room.closed = true;
    room.closedReason = "host_closed";
    room.participants.invitee = null;
    bump(room, ctx.now);
    return { ok: true };
  }

  if (action === "release_invitee_seat") {
    if (participant.seat !== "host") return fail("not_host", "席を空けられるのはホストだけです。", null);
    if (room.match !== null && room.match.phase !== "decided") {
      return fail("invalid_state", "カウントダウン開始後と対戦中は席を空けられません。", null);
    }
    if (!room.participants.invitee) return fail("invalid_state", "空ける席がありません。", null);
    room.participants.invitee = null;
    if (room.participants.host) room.participants.host.ready = false;
    bump(room, ctx.now);
    return { ok: true };
  }

  if (participant.seat === "host") {
    return fail(
      "forbidden",
      "ホストは退出ではなくRoomの終了を選んでください。",
      "「Roomを閉じる」を使ってください。",
    );
  }
  if (room.match !== null && room.match.phase !== "decided") {
    return fail("invalid_state", "対戦中は退出できません。棄権を選んでください。", null);
  }
  room.participants.invitee = null;
  if (room.participants.host) room.participants.host.ready = false;
  bump(room, ctx.now);
  return { ok: true };
}

// --- 再戦 ---------------------------------------------------------------------------

export function rematchBlockReason(room: RoomState): string | null {
  if (room.closed) return "このRoomは終了しています。";
  const match = room.match;
  if (!match || match.phase !== "decided") return "対戦の結果が出てから申し込めます。";
  if (match.persistence.state !== "saved") return "結果を保存中です。保存が終わると再戦できます。";
  if (!room.participants.host || !room.participants.invitee) return "相手の参加を待っています。";
  return null;
}

export function rematch(
  room: RoomState,
  participantKey: string,
  action: "request" | "accept" | "cancel",
  ctx: CommandContext,
): Result {
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) return fail("not_a_participant", "この操作の権限がありません。", "Roomへ入り直してください。");

  if (action === "cancel") {
    if (room.rematch?.requestedBy !== participant.seat) {
      return fail("invalid_state", "自分の申し込みだけ取り消せます。", null);
    }
    room.rematch = null;
    bump(room, ctx.now);
    return { ok: true };
  }

  const blocked = rematchBlockReason(room);
  if (blocked) return fail("rematch_blocked", blocked, null);

  if (action === "request") {
    if (room.rematch && room.rematch.requestedBy !== participant.seat) {
      // 相手の申し込みへの再申し込みは承認として扱う。
      return rematch(room, participantKey, "accept", ctx);
    }
    room.rematch = { requestedBy: participant.seat, requestedAt: ctx.now };
    bump(room, ctx.now);
    return { ok: true };
  }

  if (!room.rematch || room.rematch.requestedBy === participant.seat) {
    return fail("invalid_state", "相手からの再戦申し込みがありません。", null);
  }

  // 同じRoomと条件のまま待機へ戻す。遅着evidenceと再保存のため実体も保持する。
  if (room.match) room.archivedMatches = [room.match, ...room.archivedMatches].slice(0, 20);
  room.match = null;
  room.rematch = null;
  for (const each of bothParticipants(room)) each.ready = false;
  bump(room, ctx.now);
  return { ok: true };
}

// --- 保存状態 -------------------------------------------------------------------------

export function markPersistenceAttempt(
  room: RoomState,
  matchId: string,
  now: number,
  error: string | null,
): void {
  const match = findMatch(room, matchId);
  if (!match || match.persistence.state !== "pending") return;
  match.persistence.attempts += 1;
  match.persistence.lastAttemptAt = now;
  match.persistence.lastError = error;
  bump(room, now);
}

export function markPersisted(room: RoomState, matchId: string, now: number): void {
  const match = findMatch(room, matchId);
  if (!match) return;
  match.persistence.state = "saved";
  match.persistence.lastError = null;
  bump(room, now);
}

export function newNoticeId(random: RandomSource): string {
  return randomHex(random, 8);
}
