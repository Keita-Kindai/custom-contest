"use client";

import {
  difficultyRangeOf,
  type DiscoverQuery,
  type LibraryTab,
  type ProblemSet,
  type ProblemSetSummary,
  type SolveStatus,
  type SolveStatusMap,
} from "@custom-contest/contracts";

import { CURRENT_AUTHOR, seedProblemSets } from "./fixtures";

/**
 * 問題セットの読み書き境界。ADR-0007により、この段階ではPostgreSQLを使わない。
 * 実装をこのinterfaceの背後へ閉じてあるので、DB導入時の変更はここ1ファイルで済む。
 *
 * 現在の実装はブラウザー内保存のため、作ったセットはその端末にしか残らない。
 */
export type ProblemSetRepository = {
  discover(query: DiscoverQuery): Promise<ProblemSetSummary[]>;
  featured(kind: "new" | "liked"): Promise<ProblemSetSummary[]>;
  get(setId: string): Promise<ProblemSet | null>;
  save(set: ProblemSet): Promise<ProblemSet>;
  remove(setId: string): Promise<void>;
  library(tab: LibraryTab): Promise<ProblemSetSummary[]>;
  counts(): Promise<Record<LibraryTab, number>>;
  isLiked(setId: string): Promise<boolean>;
  isBookmarked(setId: string): Promise<boolean>;
  toggleLike(setId: string): Promise<boolean>;
  toggleBookmark(setId: string): Promise<boolean>;
  markRecent(setId: string): Promise<void>;
  solveStatuses(): Promise<SolveStatusMap>;
  setSolveStatus(problemId: string, status: SolveStatus): Promise<SolveStatusMap>;
};

const STORAGE_KEY = "custom-contest:problem-sets:v1";

type StoredState = {
  /** 利用者が作成・編集したセット。seedと同じsetIdなら上書きとして扱う。 */
  sets: ProblemSet[];
  /** seedのうち削除したもの。 */
  removed: string[];
  likes: string[];
  bookmarks: string[];
  recent: string[];
  /** problemId単位の挑戦状態。セットをまたいで1つの状態を共有する。 */
  solveStatuses: SolveStatusMap;
};

const EMPTY_STATE: StoredState = {
  sets: [],
  removed: [],
  likes: [],
  bookmarks: [],
  recent: [],
  solveStatuses: {},
};

/**
 * 保存済みのセットを現在の形へ揃える。
 * STORAGE_KEYはv1のままなので、`targetBands`を導入する前に保存されたセットにはこのfieldがない。
 * そのまま返すと想定者の表示で`undefined`を読むため、ここで空配列にする。
 */
function normalizeStoredSet(set: ProblemSet): ProblemSet {
  if (Array.isArray(set.targetBands)) return set;
  return { ...set, targetBands: [] };
}

function readState(): StoredState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      sets: Array.isArray(parsed.sets) ? parsed.sets.map(normalizeStoredSet) : [],
      removed: Array.isArray(parsed.removed) ? parsed.removed : [],
      likes: Array.isArray(parsed.likes) ? parsed.likes : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      solveStatuses:
        parsed.solveStatuses && typeof parsed.solveStatuses === "object" ? parsed.solveStatuses : {},
    };
  } catch {
    // 壊れた保存内容でも画面が開けるように、seedだけで続行する。
    return EMPTY_STATE;
  }
}

function writeState(state: StoredState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存できなくても表示は続ける。
  }
  notify();
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** 保存内容が変わったときに再描画するための購読。 */
export function subscribeProblemSets(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** seedと保存内容を重ねた、その時点の全セット。 */
function allSets(): ProblemSet[] {
  const state = readState();
  const overrides = new Map(state.sets.map((set) => [set.setId, set]));
  const removed = new Set(state.removed);
  const merged = seedProblemSets
    .filter((set) => !removed.has(set.setId))
    .map((set) => overrides.get(set.setId) ?? set);
  const seedIds = new Set(seedProblemSets.map((set) => set.setId));
  const added = state.sets.filter((set) => !seedIds.has(set.setId));
  return [...added, ...merged];
}

export function toSummary(set: ProblemSet): ProblemSetSummary {
  return {
    setId: set.setId,
    title: set.title,
    tags: set.tags,
    visibility: set.visibility,
    status: set.status,
    authorName: set.authorName,
    likeCount: set.likeCount,
    updatedAt: set.updatedAt,
    targetBands: set.targetBands,
    problemCount: set.problems.length,
    problemIds: set.problems.map((problem) => problem.problemId),
    difficultyRange: difficultyRangeOf(set.problems),
  };
}

function matchesQuery(set: ProblemSet, query: DiscoverQuery): boolean {
  if (query.tags.length > 0 && !query.tags.every((tag) => set.tags.includes(tag))) return false;
  if (query.q) {
    const haystack = `${set.title} ${set.description} ${set.authorName} ${set.tags.join(" ")}`.toLowerCase();
    const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  const range = difficultyRangeOf(set.problems);
  if (query.difficultyMin !== null && (range === null || range.max < query.difficultyMin)) return false;
  if (query.difficultyMax !== null && (range === null || range.min > query.difficultyMax)) return false;
  return true;
}

function sorted(sets: ProblemSet[], sort: DiscoverQuery["sort"]): ProblemSet[] {
  const copy = [...sets];
  if (sort === "new") return copy.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  if (sort === "liked") return copy.sort((a, b) => b.likeCount - a.likeCount);
  return copy.sort((a, b) => b.useCount - a.useCount || b.likeCount - a.likeCount);
}

/**
 * Discoverの一覧へ載せてよいか。
 * 下書きと非公開は自分のものでも載せず、ライブラリからだけ辿れるようにする。
 * 限定公開はURLを知っていれば開けるが、一覧には載せない。
 */
function listableInDiscover(set: ProblemSet): boolean {
  return set.status === "published" && set.visibility === "public";
}

export const problemSetRepository: ProblemSetRepository = {
  async discover(query) {
    return sorted(allSets().filter(listableInDiscover).filter((set) => matchesQuery(set, query)), query.sort).map(
      toSummary,
    );
  },

  async featured(kind) {
    const visible = allSets().filter(listableInDiscover);
    return sorted(visible, kind === "new" ? "new" : "liked").slice(0, 4).map(toSummary);
  },

  async get(setId) {
    return allSets().find((set) => set.setId === setId) ?? null;
  },

  async save(set) {
    const state = readState();
    const next = state.sets.filter((candidate) => candidate.setId !== set.setId);
    next.push(set);
    writeState({ ...state, sets: next, removed: state.removed.filter((id) => id !== set.setId) });
    return set;
  },

  async remove(setId) {
    const state = readState();
    writeState({
      ...state,
      sets: state.sets.filter((set) => set.setId !== setId),
      removed: state.removed.includes(setId) ? state.removed : [...state.removed, setId],
    });
  },

  async library(tab) {
    const state = readState();
    const sets = allSets();
    if (tab === "created") {
      return sets
        .filter((set) => set.authorName === CURRENT_AUTHOR)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .map(toSummary);
    }
    if (tab === "recent") {
      return state.recent
        .map((setId) => sets.find((set) => set.setId === setId))
        .filter((set): set is ProblemSet => set !== undefined)
        .map(toSummary);
    }
    const ids = new Set(tab === "liked" ? state.likes : state.bookmarks);
    return sets.filter((set) => ids.has(set.setId)).map(toSummary);
  },

  async counts() {
    const state = readState();
    const sets = allSets();
    return {
      created: sets.filter((set) => set.authorName === CURRENT_AUTHOR).length,
      liked: state.likes.length,
      bookmarked: state.bookmarks.length,
      recent: state.recent.length,
    };
  },

  async isLiked(setId) {
    return readState().likes.includes(setId);
  },

  async isBookmarked(setId) {
    return readState().bookmarks.includes(setId);
  },

  async toggleLike(setId) {
    const state = readState();
    const liked = state.likes.includes(setId);
    writeState({
      ...state,
      likes: liked ? state.likes.filter((id) => id !== setId) : [...state.likes, setId],
    });
    return !liked;
  },

  async toggleBookmark(setId) {
    const state = readState();
    const bookmarked = state.bookmarks.includes(setId);
    writeState({
      ...state,
      bookmarks: bookmarked ? state.bookmarks.filter((id) => id !== setId) : [...state.bookmarks, setId],
    });
    return !bookmarked;
  },

  async markRecent(setId) {
    const state = readState();
    writeState({ ...state, recent: [setId, ...state.recent.filter((id) => id !== setId)].slice(0, 12) });
  },

  async solveStatuses() {
    return readState().solveStatuses;
  },

  async setSolveStatus(problemId, status) {
    const state = readState();
    const next = { ...state.solveStatuses };
    // 未ACは既定値なので、記録を残さず削除する。
    if (status === "unsolved") delete next[problemId];
    else next[problemId] = status;
    writeState({ ...state, solveStatuses: next });
    return next;
  },
};

/** いいね数の表示値。自分の操作分をseedの値へ足して見せる。 */
export function displayedLikeCount(summary: ProblemSetSummary, liked: boolean): number {
  const seed = seedProblemSets.find((set) => set.setId === summary.setId);
  const base = seed ? seed.likeCount : summary.likeCount;
  return liked ? base + 1 : base;
}

export function newProblemSetId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `ps_${[...bytes].map((byte) => alphabet[byte % alphabet.length]).join("")}`;
}
