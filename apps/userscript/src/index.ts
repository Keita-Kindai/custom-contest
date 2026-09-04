type ScriptLink = {
  scriptToken: string;
  roomId: string;
  seat: "host" | "invitee";
  profileAtcoderId: string;
};

type ActiveMatch = {
  matchId: string;
  contestId: string;
  problemId: string;
  startsAt: string;
  deadlineAt: string;
  discardOutboxAfter: string | null;
  statusJsonPath: string;
  submissionsPath: string;
};

type HeartbeatResponse = {
  ok: true;
  activeMatch: ActiveMatch | null;
  stopped: boolean;
  heartbeatIntervalMs: number;
  pollIntervalMs: number;
};

type Evidence = {
  atcoderId: string;
  submissionId: number;
  contestId: string;
  problemId: string;
  submittedAt: string;
  status: "pending" | "final";
  verdict: string | null;
  language: string | null;
  source: "atcoder";
};

type OutboxEntry = { matchId: string; evidence: Evidence; queuedAt: number };

const LINK_STORAGE = "custom-contest:link:v1";
const OUTBOX_STORAGE = "custom-contest:outbox:v1";
const SEEN_STORAGE = "custom-contest:seen:v1";
const SCRIPT_VERSION = "0.1.2-demo";
const FALLBACK_INTERVAL_MS = 5_000;
const JUDGE_RECHECK_INTERVAL_MS = 15_000;
const MAX_ATCODER_BACKOFF_MS = 60_000;
const STATUS_AUTO_HIDE_MS = 4_000;

let link = GM_getValue<ScriptLink | null>(LINK_STORAGE, null);
let activeMatch: ActiveMatch | null = null;
let heartbeatTimer: number | null = null;
let pollTimer: number | null = null;
let statusHideTimer: number | null = null;
let pollInFlight = false;
let connectionRetrying = false;
let pollingRetrying = false;
let outboxRetrying = false;
let lastJudgeReachable = false;
let nextJudgeCheckAt = 0;
let consecutivePollFailures = 0;

function requestJson<T>(path: string, body: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: `${__SERVER_ORIGIN__}${path}`,
      headers: { "content-type": "application/json" },
      data: JSON.stringify(body),
      timeout: 8_000,
      onload(response) {
        try {
          const value = JSON.parse(response.responseText) as T | { error?: { message?: string } };
          if (response.status < 200 || response.status >= 300) {
            const error = value as { error?: { message?: string } };
            reject(new Error(error.error?.message ?? `Custom Contest returned ${response.status}`));
            return;
          }
          resolve(value as T);
        } catch {
          reject(new Error("Custom Contest returned an unreadable response"));
        }
      },
      onerror: () => reject(new Error("Custom Contest is unreachable")),
      ontimeout: () => reject(new Error("Custom Contest request timed out")),
    });
  });
}

function loginAtcoderId(): string | null {
  const anchors = document.querySelectorAll<HTMLAnchorElement>(
    "nav a[href^='/users/'], header a[href^='/users/'], #navbar-collapse a[href^='/users/']",
  );
  for (const anchor of anchors) {
    const match = new URL(anchor.href, location.origin).pathname.match(/^\/users\/([A-Za-z0-9_]+)$/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function statusIndicator(): HTMLElement {
  let element = document.querySelector<HTMLElement>("#custom-contest-bridge-status");
  if (element) return element;
  element = document.createElement("div");
  element.id = "custom-contest-bridge-status";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");
  element.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 12px;border:1px solid #3c3835;background:#171513;color:#f4f1ee;font:12px/1.4 monospace;border-radius:4px;box-shadow:0 6px 24px #0008";
  document.body.append(element);
  return element;
}

function showStatus(message: string, ok = false, autoHide = ok): void {
  const element = statusIndicator();
  element.hidden = false;
  element.textContent = `AC Duel · ${message}`;
  element.style.borderColor = ok ? "#73d17c" : "#d8a657";
  if (statusHideTimer !== null) window.clearTimeout(statusHideTimer);
  statusHideTimer = autoHide
    ? window.setTimeout(() => {
        element.hidden = true;
        statusHideTimer = null;
      }, STATUS_AUTO_HIDE_MS)
    : null;
}

async function judgeReachable(
  target: ActiveMatch | null,
): Promise<{ reachable: boolean; nextCheckInMs: number }> {
  const path = target?.statusJsonPath ?? "/contests/abc001/submissions/me/status/json";
  try {
    const response = await fetch(`${path}?sids[]=0`, {
      credentials: "same-origin",
      headers: { "x-requested-with": "XMLHttpRequest" },
      cache: "no-store",
    });
    return {
      reachable: response.ok,
      nextCheckInMs: response.ok
        ? JUDGE_RECHECK_INTERVAL_MS
        : [401, 403, 429].includes(response.status)
          ? MAX_ATCODER_BACKOFF_MS
          : JUDGE_RECHECK_INTERVAL_MS * 2,
    };
  } catch {
    return { reachable: false, nextCheckInMs: JUDGE_RECHECK_INTERVAL_MS * 2 };
  }
}

async function cachedJudgeReachable(target: ActiveMatch | null): Promise<boolean> {
  const now = Date.now();
  if (now < nextJudgeCheckAt) {
    return lastJudgeReachable;
  }
  const result = await judgeReachable(target);
  lastJudgeReachable = result.reachable;
  nextJudgeCheckAt = now + result.nextCheckInMs;
  return lastJudgeReachable;
}

function noteJudgeAvailability(reachable: boolean, nextCheckInMs?: number): void {
  const now = Date.now();
  lastJudgeReachable = reachable;
  nextJudgeCheckAt = now + (nextCheckInMs ?? (reachable ? JUDGE_RECHECK_INTERVAL_MS : JUDGE_RECHECK_INTERVAL_MS * 2));
}

function stripLinkFragment(): void {
  const url = new URL(location.href);
  url.hash = "";
  history.replaceState(history.state, "", url);
}

async function acceptLinkFromFragment(): Promise<void> {
  const params = new URLSearchParams(location.hash.slice(1));
  const linkKey = params.get("cc-link");
  if (!linkKey) return;
  stripLinkFragment();
  showStatus("Roomへ接続中");
  try {
    const connected = await requestJson<ScriptLink>("/api/userscript/link", {
      linkKey,
      loginAtcoderId: loginAtcoderId(),
      scriptVersion: SCRIPT_VERSION,
    });
    link = connected;
    GM_setValue(LINK_STORAGE, connected);
    GM_setValue(OUTBOX_STORAGE, [] as OutboxEntry[]);
    GM_setValue(SEEN_STORAGE, {} as Record<string, "pending" | "final">);
    connectionRetrying = false;
    showStatus(`Room ${connected.roomId} に接続`, true);
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "接続できませんでした");
  }
}

function readOutbox(): OutboxEntry[] {
  return GM_getValue<OutboxEntry[]>(OUTBOX_STORAGE, []);
}

function writeOutbox(entries: OutboxEntry[]): void {
  GM_setValue(OUTBOX_STORAGE, entries.slice(-100));
}

function queueEvidence(matchId: string, evidence: Evidence): void {
  const outbox = readOutbox().filter(
    (entry) => !(entry.matchId === matchId && entry.evidence.submissionId === evidence.submissionId),
  );
  outbox.push({ matchId, evidence, queuedAt: Date.now() });
  writeOutbox(outbox);
}

async function flushOutbox(): Promise<void> {
  if (!link) return;
  const now = Date.now();
  const discardAt = activeMatch?.discardOutboxAfter ? Date.parse(activeMatch.discardOutboxAfter) : null;
  let outbox = readOutbox().filter((entry) => discardAt === null || now <= discardAt);
  const groups = new Map<string, OutboxEntry[]>();
  for (const entry of outbox) groups.set(entry.matchId, [...(groups.get(entry.matchId) ?? []), entry]);

  for (const [matchId, entries] of groups) {
    try {
      const response = await requestJson<{ accepted: number[]; rejected: { submissionId: number }[] }>(
        "/api/userscript/evidence",
        { scriptToken: link.scriptToken, matchId, submissions: entries.map((entry) => entry.evidence) },
      );
      const acknowledged = new Set([
        ...response.accepted,
        ...response.rejected.map((entry) => entry.submissionId),
      ]);
      outbox = outbox.filter(
        (entry) => entry.matchId !== matchId || !acknowledged.has(entry.evidence.submissionId),
      );
      writeOutbox(outbox);
    } catch {
      if (!outboxRetrying) showStatus("通知を再送中");
      outboxRetrying = true;
      return;
    }
  }
  if (outboxRetrying) showStatus("通知の送信を再開しました", true);
  outboxRetrying = false;
}

function normalizedVerdict(raw: string): string | null {
  const text = raw.trim().toUpperCase();
  if (!text || text === "WJ" || text === "WR" || /^\d+\s*\/\s*\d+/.test(text)) return null;
  return text.match(/([A-Z]{2,4})\s*$/)?.[1] ?? null;
}

function parsedSubmissionRows(html: string, target: ActiveMatch): Evidence[] {
  const documentCopy = new DOMParser().parseFromString(html, "text/html");
  const rows = documentCopy.querySelectorAll<HTMLTableRowElement>(".table-responsive table tbody tr");
  const entries: Evidence[] = [];
  for (const row of rows) {
    const submissionAnchor = [...row.querySelectorAll<HTMLAnchorElement>("a[href*='/submissions/']")].at(-1);
    const taskAnchor = row.querySelector<HTMLAnchorElement>(`a[href*="/tasks/${target.problemId}"]`);
    const idMatch = submissionAnchor?.href.match(/\/submissions\/(\d+)$/);
    if (!idMatch?.[1] || !taskAnchor) continue;
    const timeElement = row.querySelector<HTMLTimeElement>("time");
    const submittedAtRaw = timeElement?.dateTime || timeElement?.textContent?.trim() || "";
    const submittedAtMs = Date.parse(submittedAtRaw);
    if (!Number.isFinite(submittedAtMs)) continue;
    if (submittedAtMs < Date.parse(target.startsAt) || submittedAtMs > Date.parse(target.deadlineAt)) continue;
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    const label = row.querySelector<HTMLElement>(".label")?.textContent ?? "";
    const verdict = normalizedVerdict(label);
    entries.push({
      atcoderId: link?.profileAtcoderId ?? "",
      submissionId: Number(idMatch[1]),
      contestId: target.contestId,
      problemId: target.problemId,
      submittedAt: new Date(submittedAtMs).toISOString(),
      status: verdict ? "final" : "pending",
      verdict,
      language: cells[3]?.textContent?.trim() || null,
      source: "atcoder",
    });
  }
  return entries;
}

async function pollSubmissions(): Promise<void> {
  const target = activeMatch;
  if (!link || !target || pollInFlight) return;
  pollInFlight = true;
  let failureFloor = 1;
  try {
    const response = await fetch(target.submissionsPath, { credentials: "same-origin", cache: "no-store" });
    if ([401, 403, 429].includes(response.status)) failureFloor = 4;
    if (!response.ok) throw new Error("submission list unavailable");
    noteJudgeAvailability(true);
    consecutivePollFailures = 0;
    const entries = parsedSubmissionRows(await response.text(), target);
    const seen = GM_getValue<Record<string, "pending" | "final">>(SEEN_STORAGE, {});
    for (const evidence of entries) {
      const state = seen[String(evidence.submissionId)];
      if (state === "final" || state === evidence.status) continue;
      seen[String(evidence.submissionId)] = evidence.status;
      queueEvidence(target.matchId, evidence);
    }
    GM_setValue(SEEN_STORAGE, seen);
    await flushOutbox();
    if (pollingRetrying) showStatus("判定監視を再開しました", true);
    pollingRetrying = false;
  } catch {
    noteJudgeAvailability(false, failureFloor === 4 ? MAX_ATCODER_BACKOFF_MS : undefined);
    consecutivePollFailures = Math.min(4, Math.max(failureFloor, consecutivePollFailures + 1));
    if (!pollingRetrying) showStatus("AtCoderの判定確認を再試行中");
    pollingRetrying = true;
  } finally {
    pollInFlight = false;
  }
}

function schedulePoll(intervalMs: number): void {
  if (pollTimer !== null || !activeMatch) return;
  const delayMs = Math.min(intervalMs * 2 ** consecutivePollFailures, MAX_ATCODER_BACKOFF_MS);
  pollTimer = window.setTimeout(async () => {
    pollTimer = null;
    await pollSubmissions();
    schedulePoll(intervalMs);
  }, delayMs);
}

async function sendHeartbeat(): Promise<void> {
  if (!link) return;
  const checkedAt = new Date().toISOString();
  try {
    const response = await requestJson<HeartbeatResponse>("/api/userscript/heartbeat", {
      scriptToken: link.scriptToken,
      health: {
        loggedIn: loginAtcoderId() !== null,
        loginAtcoderId: loginAtcoderId(),
        judgeReachable: await cachedJudgeReachable(activeMatch),
        checkedAt,
      },
    });
    if (response.stopped) {
      GM_deleteValue(LINK_STORAGE);
      link = null;
      activeMatch = null;
      showStatus("Roomが終了しました");
      return;
    }
    const previousMatchId = activeMatch?.matchId;
    activeMatch = response.activeMatch;
    if (activeMatch?.matchId !== previousMatchId) GM_setValue(SEEN_STORAGE, {} as Record<string, "pending" | "final">);
    await flushOutbox();
    if (activeMatch) {
      if (activeMatch.matchId !== previousMatchId) {
        if (pollTimer !== null) window.clearTimeout(pollTimer);
        pollTimer = null;
      }
      schedulePoll(response.pollIntervalMs);
    } else if (pollTimer !== null) {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (connectionRetrying) showStatus(`Room ${link.roomId} に再接続しました`, true);
    connectionRetrying = false;
    scheduleHeartbeat(response.heartbeatIntervalMs);
  } catch {
    if (!connectionRetrying) showStatus("Custom Contestへ再接続中");
    connectionRetrying = true;
    scheduleHeartbeat(FALLBACK_INTERVAL_MS);
  }
}

function scheduleHeartbeat(intervalMs: number): void {
  if (heartbeatTimer !== null) window.clearTimeout(heartbeatTimer);
  heartbeatTimer = window.setTimeout(sendHeartbeat, intervalMs);
}

async function main(): Promise<void> {
  await acceptLinkFromFragment();
  if (!link) return;
  showStatus(`Room ${link.roomId} に接続`, true);
  await sendHeartbeat();
}

void main();
