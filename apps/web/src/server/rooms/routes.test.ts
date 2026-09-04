import { beforeEach, describe, expect, it } from "vitest";

import { PARTICIPANT_KEY_HEADER, type JoinedRoomResponse, type SnapshotResponse } from "@custom-contest/contracts";
import { issueLinkKey } from "@custom-contest/domain";

import { POST as evidencePost } from "../../app/api/userscript/evidence/route";
import { POST as heartbeatPost } from "../../app/api/userscript/heartbeat/route";
import { POST as linkPost } from "../../app/api/userscript/link/route";
import { POST as joinPost } from "../../app/api/rooms/[roomId]/join/route";
import { GET as roomGet } from "../../app/api/rooms/[roomId]/route";
import { POST as readyPost } from "../../app/api/rooms/[roomId]/ready/route";
import { POST as startPost } from "../../app/api/rooms/[roomId]/start/route";
import { commandContext, roomStore } from "./store";

const routeContext = (roomId: string) => ({ params: Promise.resolve({ roomId }) });

function post(url: string, value: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}

describe("Room Route Handlers", () => {
  beforeEach(() => {
    roomStore().rooms.clear();
    roomStore().savingMatches.clear();
  });

  it("completes the two-participant API path through a real evidence ACK", async () => {
    const { room, participant: host } = roomStore().create(
      { mode: "BO1", limitMinutes: 10, problemIndexes: ["C", "D"], difficultyMin: 400, difficultyMax: 1200 },
      "Litms",
      commandContext(),
    );
    const joinResponse = await joinPost(
      post(`http://localhost/api/rooms/${room.roomId}/join`, { atcoderId: "friend_1400" }),
      routeContext(room.roomId),
    );
    expect(joinResponse.status).toBe(200);
    const joined = (await joinResponse.json()) as JoinedRoomResponse;

    const tokens: Record<"host" | "invitee", string> = { host: "", invitee: "" };
    for (const entry of [
      { participantKey: host.participantKey, id: "Litms", seat: "host" as const },
      { participantKey: joined.participantKey, id: "friend_1400", seat: "invitee" as const },
    ]) {
      const issued = issueLinkKey(room, entry.participantKey, commandContext());
      if (!issued.ok) throw new Error(issued.message);
      const linked = await linkPost(
        post("http://localhost/api/userscript/link", {
          linkKey: issued.linkKey,
          loginAtcoderId: entry.id,
          scriptVersion: "test",
        }),
      );
      expect(linked.status).toBe(200);
      tokens[entry.seat] = ((await linked.json()) as { scriptToken: string }).scriptToken;
      const health = await heartbeatPost(
        post("http://localhost/api/userscript/heartbeat", {
          scriptToken: tokens[entry.seat],
          health: { loggedIn: true, loginAtcoderId: entry.id, judgeReachable: true, checkedAt: new Date().toISOString() },
        }),
      );
      expect(health.status).toBe(200);
      const ready = await readyPost(
        post(`http://localhost/api/rooms/${room.roomId}/ready`, { participantKey: entry.participantKey, ready: true }),
        routeContext(room.roomId),
      );
      expect(ready.status).toBe(200);
    }

    const started = await startPost(
      post(`http://localhost/api/rooms/${room.roomId}/start`, { participantKey: host.participantKey }),
      routeContext(room.roomId),
    );
    expect(started.status).toBe(200);
    if (!room.match) throw new Error("match missing");
    room.match.startsAt = Date.now() - 1_000;
    room.match.deadlineAt = Date.now() + 599_000;

    const evidence = {
      scriptToken: tokens.invitee,
      matchId: room.match.matchId,
      submissions: [
        {
          atcoderId: "friend_1400",
          submissionId: 90000001,
          contestId: room.match.problem.contestId,
          problemId: room.match.problem.problemId,
          submittedAt: new Date().toISOString(),
          status: "final",
          verdict: "AC",
          language: "C++ 23",
          source: "atcoder",
        },
      ],
    };
    const accepted = await evidencePost(post("http://localhost/api/userscript/evidence", evidence));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ accepted: [90000001], rejected: [] });
    const duplicate = await evidencePost(post("http://localhost/api/userscript/evidence", evidence));
    expect(duplicate.status).toBe(200);
    expect(room.match.submissions).toHaveLength(1);

    for (const participantKey of [host.participantKey, joined.participantKey]) {
      const snapshotRequest = new Request(`http://localhost/api/rooms/${room.roomId}`, {
        headers: { [PARTICIPANT_KEY_HEADER]: participantKey },
      });
      const response = await roomGet(snapshotRequest, routeContext(room.roomId));
      const body = (await response.json()) as SnapshotResponse;
      expect(body.snapshot.match?.result).toMatchObject({ outcome: "win", winnerSeat: "invitee" });
    }
  });

  it("returns a readable validation error instead of accepting malformed JSON", async () => {
    const response = await joinPost(
      new Request("http://localhost/api/rooms/ABC234/join", { method: "POST", body: "{" }),
      routeContext("ABC234"),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
  });
});
