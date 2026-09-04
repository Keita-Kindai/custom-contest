export const PROFILE_KEY = "ac-duel:atcoder-id";
export const RECENT_MATCHES_KEY = "ac-duel:recent-match-paths";
const MATCH_PATH_PATTERN = /^\/battle\/m\/m_[0-9a-f]{26}$/;

export function getAtcoderId(): string {
  return window.localStorage.getItem(PROFILE_KEY)?.trim() || "Litms";
}

export function participantKeyName(roomId: string): string {
  return `ac-duel:participant:${roomId.toUpperCase()}`;
}

export function getParticipantKey(roomId: string): string | null {
  return window.localStorage.getItem(participantKeyName(roomId));
}

export function saveParticipantKey(roomId: string, participantKey: string): void {
  window.localStorage.setItem(participantKeyName(roomId), participantKey);
}

export function recentMatchPathsSnapshot(): string {
  return window.localStorage.getItem(RECENT_MATCHES_KEY) ?? "[]";
}

export function subscribeRecentMatchPaths(onChange: () => void): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === RECENT_MATCHES_KEY) onChange();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function getRecentMatchPaths(serialized = recentMatchPathsSnapshot()): string[] {
  try {
    const value = JSON.parse(serialized) as unknown;
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string" && MATCH_PATH_PATTERN.test(entry)).slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentMatchPath(matchPath: string): void {
  if (!MATCH_PATH_PATTERN.test(matchPath)) return;
  const next = [matchPath, ...getRecentMatchPaths().filter((entry) => entry !== matchPath)].slice(0, 3);
  const serialized = JSON.stringify(next);
  window.localStorage.setItem(RECENT_MATCHES_KEY, serialized);
  window.dispatchEvent(new StorageEvent("storage", { key: RECENT_MATCHES_KEY, newValue: serialized }));
}

type ApiFailure = { error?: { message?: string; fix?: string | null } };

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    const message = body.error?.message ?? `サーバーからエラー（${response.status}）が返りました。`;
    throw new Error(body.error?.fix ? `${message} ${body.error.fix}` : message);
  }
  return body;
}
