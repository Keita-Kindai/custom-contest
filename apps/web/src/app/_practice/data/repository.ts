"use client";

import type {
  DiscoverQuery,
  LibraryTab,
  ProblemSet,
  ProblemSetInput,
  ProblemSetSummary,
  SetSolveStatusMap,
  SolveStatus,
  SolveStatusMap,
} from "@custom-contest/contracts";

/**
 * 問題セットの読み書き境界（ADR-0011）。
 *
 * 実体はPostgreSQLで、この層はserverの`/api/problem-sets/*`を叩くだけ。
 * 持ち主やいいねの本人は、serverがsessionから決める。この層は誰なのかを送らない。
 *
 * ブラウザー内保存はもう使わない。作ったセットはアカウントに残り、別の端末からも開ける。
 */
export type ProblemSetRepository = {
  discover(query: DiscoverQuery): Promise<ProblemSetSummary[]>;
  featured(kind: "new" | "liked"): Promise<ProblemSetSummary[]>;
  get(setId: string): Promise<ProblemSet | null>;
  save(input: ProblemSetInput): Promise<ProblemSet>;
  remove(setId: string): Promise<void>;
  library(tab: LibraryTab): Promise<ProblemSetSummary[]>;
  counts(): Promise<Record<LibraryTab, number>>;
  /** 自分とそのセットの関係。未ログインならすべてfalse。 */
  viewerState(setId: string): Promise<ViewerState>;
  toggleLike(setId: string): Promise<boolean>;
  toggleBookmark(setId: string): Promise<boolean>;
  markRecent(setId: string): Promise<void>;
  /** 1つのセットの中の挑戦状態。 */
  solveStatuses(setId: string): Promise<SolveStatusMap>;
  /** 全セットぶん。ライブラリが進み具合で分けるときに使う。 */
  allSolveStatuses(): Promise<SetSolveStatusMap>;
  setSolveStatus(setId: string, problemId: string, status: SolveStatus): Promise<SolveStatusMap>;
};

export type ViewerState = { isOwner: boolean; liked: boolean; bookmarked: boolean };

const EMPTY_VIEWER_STATE: ViewerState = { isOwner: false, liked: false, bookmarked: false };
const EMPTY_COUNTS: Record<LibraryTab, number> = { created: 0, bookmarked: 0, liked: 0, recent: 0 };

/** serverが返したエラー。画面はこのmessageをそのまま出せる。 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fix: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/problem-sets${path}`, { cache: "no-store", ...init });
  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string; fix?: string | null } }
    | null;
  throw new ApiError(
    body?.error?.message ?? "通信に失敗しました。",
    response.status,
    body?.error?.fix ?? null,
  );
}

/**
 * ログインしていないときに呼ばれた読み出しは、空として扱う。
 * マイページのような画面は未ログインでも開けるので、401で落とさず空で描く。
 */
async function requestOrEmpty<T>(path: string, empty: T): Promise<T> {
  try {
    return await request<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return empty;
    throw error;
  }
}

function jsonBody(value: unknown): RequestInit {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

function discoverParams(query: DiscoverQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  for (const tag of query.tags) params.append("tags", tag);
  for (const band of query.bands) params.append("bands", band);
  params.set("sort", query.sort);
  if (query.difficultyMin !== null) params.set("difficultyMin", String(query.difficultyMin));
  if (query.difficultyMax !== null) params.set("difficultyMax", String(query.difficultyMax));
  return params.toString();
}

const listeners = new Set<() => void>();

/** 書き込みのあとに一覧を取り直すための購読。 */
export function subscribeProblemSets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export const problemSetRepository: ProblemSetRepository = {
  async discover(query) {
    return request<ProblemSetSummary[]>(`?${discoverParams(query)}`);
  },

  async featured(kind) {
    return request<ProblemSetSummary[]>(`/featured?kind=${kind}`);
  },

  async get(setId) {
    try {
      return await request<ProblemSet>(`/${setId}`);
    } catch (error) {
      // 「無い」と「見せてよくない」はserverが区別せず404を返す。画面も区別しない。
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async save(input) {
    const saved = await request<ProblemSet>(`/${input.setId}`, jsonBody(input));
    notify();
    return saved;
  },

  async remove(setId) {
    await request<{ ok: true }>(`/${setId}`, { method: "DELETE" });
    notify();
  },

  async library(tab) {
    return requestOrEmpty<ProblemSetSummary[]>(`/library?tab=${tab}`, []);
  },

  async counts() {
    return requestOrEmpty<Record<LibraryTab, number>>("/counts", EMPTY_COUNTS);
  },

  async viewerState(setId) {
    return requestOrEmpty<ViewerState>(`/${setId}/viewer`, EMPTY_VIEWER_STATE);
  },

  async toggleLike(setId) {
    const { liked } = await request<{ liked: boolean }>(`/${setId}/like`, { method: "POST" });
    notify();
    return liked;
  },

  async toggleBookmark(setId) {
    const { bookmarked } = await request<{ bookmarked: boolean }>(`/${setId}/bookmark`, {
      method: "POST",
    });
    notify();
    return bookmarked;
  },

  async markRecent(setId) {
    // 未ログインでも詳細は開ける。記録できなくても画面は続ける。
    await request<{ ok: true }>(`/${setId}/view`, { method: "POST" }).catch(() => undefined);
  },

  async solveStatuses(setId) {
    return requestOrEmpty<SolveStatusMap>(`/${setId}/solve-status`, {});
  },

  async allSolveStatuses() {
    return requestOrEmpty<SetSolveStatusMap>("/solve-status", {});
  },

  async setSolveStatus(setId, problemId, status) {
    const next = await request<SolveStatusMap>(
      `/${setId}/solve-status`,
      jsonBody({ problemId, status }),
    );
    notify();
    return next;
  },
};

export function newProblemSetId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `ps_${[...bytes].map((byte) => alphabet[byte % alphabet.length]).join("")}`;
}
