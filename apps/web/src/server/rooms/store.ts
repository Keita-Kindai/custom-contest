import {
  RESULT_SAVE_RETRY_INTERVAL_MS,
  type ApiErrorCode,
  type Seat,
} from "@custom-contest/contracts";
import {
  allMatches,
  buildSnapshot,
  createRoom,
  cryptoRandomSource,
  findByParticipantKey,
  findByScriptToken,
  markPersisted,
  markPersistenceAttempt,
  newRoomId,
  tick,
  touch,
  type CommandContext,
  type ParticipantState,
  type RoomState,
} from "@custom-contest/domain";

import { saveStoredMatch, storedMatchFromState } from "../db/matches";

type StoreGlobal = typeof globalThis & { __customContestRoomStore?: RoomStore };

export function fakeEvidenceEnabled(): boolean {
  return process.env.NODE_ENV === "test" || process.env.CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE === "1";
}

export function commandContext(now = Date.now()): CommandContext {
  return { now, random: cryptoRandomSource, fakeEvidenceEnabled: fakeEvidenceEnabled() };
}

export class RoomStore {
  readonly rooms = new Map<string, RoomState>();
  readonly savingMatches = new Set<string>();

  create(settings: RoomState["settings"], hostAtcoderId: string, ctx: CommandContext) {
    let roomId = newRoomId(ctx.random);
    while (this.rooms.has(roomId)) roomId = newRoomId(ctx.random);
    const created = createRoom(settings, hostAtcoderId, ctx, roomId);
    this.rooms.set(roomId, created.room);
    return created;
  }

  get(roomId: string): RoomState | null {
    return this.rooms.get(roomId.toUpperCase()) ?? null;
  }

  findParticipantByLinkKey(linkKey: string): { room: RoomState; participant: ParticipantState } | null {
    for (const room of this.rooms.values()) {
      const participant = [room.participants.host, room.participants.invitee].find(
        (candidate) => candidate?.pendingLinkKey?.linkKey === linkKey,
      );
      if (participant) return { room, participant };
    }
    return null;
  }

  findParticipantByScriptToken(scriptToken: string): { room: RoomState; participant: ParticipantState } | null {
    for (const room of this.rooms.values()) {
      const participant = findByScriptToken(room, scriptToken);
      if (participant) return { room, participant };
    }
    return null;
  }

  findRoomByMatch(matchId: string): RoomState | null {
    for (const room of this.rooms.values()) {
      if (allMatches(room).some((match) => match.matchId === matchId)) return room;
    }
    return null;
  }
}

export function roomStore(): RoomStore {
  const globalState = globalThis as StoreGlobal;
  globalState.__customContestRoomStore ??= new RoomStore();
  return globalState.__customContestRoomStore;
}

export type RoomAccess =
  | { ok: true; room: RoomState; participant: ParticipantState; seat: Seat }
  | { ok: false; code: ApiErrorCode; message: string; fix: string | null };

export function accessRoom(roomId: string, participantKey: string | null): RoomAccess {
  const room = roomStore().get(roomId);
  if (!room) {
    return { ok: false, code: "room_not_found", message: "Roomが見つかりません。", fix: "Room IDを確認してください。" };
  }
  if (!participantKey) {
    return { ok: false, code: "not_a_participant", message: "参加者キーがありません。", fix: "Roomへ入り直してください。" };
  }
  const participant = findByParticipantKey(room, participantKey);
  if (!participant) {
    return { ok: false, code: "not_a_participant", message: "このRoomの参加者キーではありません。", fix: "Roomへ入り直してください。" };
  }
  return { ok: true, room, participant, seat: participant.seat };
}

export async function advanceAndPersist(room: RoomState, now = Date.now()): Promise<void> {
  tick(room, now);
  const store = roomStore();
  for (const match of allMatches(room)) {
    if (match.persistence.state !== "pending" || store.savingMatches.has(match.matchId)) continue;
    const lastAttemptAt = match.persistence.lastAttemptAt;
    if (lastAttemptAt !== null && now - lastAttemptAt < RESULT_SAVE_RETRY_INTERVAL_MS) continue;

    store.savingMatches.add(match.matchId);
    markPersistenceAttempt(room, match.matchId, now, null);
    try {
      await saveStoredMatch(storedMatchFromState(room, match));
      markPersisted(room, match.matchId, Date.now());
    } catch {
      match.persistence.lastError = "PostgreSQLへ結果を保存できませんでした。自動的に再試行します。";
    } finally {
      store.savingMatches.delete(match.matchId);
    }
  }
}

export async function snapshotFor(
  room: RoomState,
  participant: ParticipantState,
  options: { touchParticipant?: boolean } = {},
) {
  const now = Date.now();
  if (options.touchParticipant !== false) touch(room, participant, now);
  await advanceAndPersist(room, now);
  return buildSnapshot(room, participant.seat, Date.now(), { fakeEvidenceEnabled: fakeEvidenceEnabled() });
}
