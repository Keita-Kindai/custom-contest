"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PROBLEM_SET_TAGS,
  VISIBILITY_LABEL,
  difficultyRangeOf,
  estimateMinutes,
  visibilitySchema,
  type CatalogProblem,
  type ProblemSearchResponse,
  type ProblemSet,
  type ProblemSetTag,
  type Visibility,
} from "@custom-contest/contracts";

import { DifficultyDot, DifficultyRangeChip, TagPill } from "./components/atoms";
import { CURRENT_AUTHOR } from "./data/fixtures";
import { newProblemSetId, problemSetRepository } from "./data/repository";

/** Diff帯のプリセット。検索の絞り込みに使う。 */
const DIFFICULTY_BANDS: { label: string; min: number | null; max: number | null }[] = [
  { label: "すべて", min: null, max: null },
  { label: "〜399 灰", min: null, max: 399 },
  { label: "400–799 茶", min: 400, max: 799 },
  { label: "800–1199 緑", min: 800, max: 1199 },
  { label: "1200–1599 水", min: 1200, max: 1599 },
  { label: "1600–1999 青", min: 1600, max: 1999 },
  { label: "2000– 紫", min: 2000, max: null },
];

export function SetEditorView({ setId }: { setId?: string }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<ProblemSetTag[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [problems, setProblems] = useState<CatalogProblem[]>([]);
  const [loaded, setLoaded] = useState(setId === undefined);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [term, setTerm] = useState("");
  const [bandIndex, setBandIndex] = useState(0);
  const [results, setResults] = useState<ProblemSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestId = useRef(0);

  // 編集時は既存の内容を初期値にする。
  useEffect(() => {
    if (!setId) return;
    void problemSetRepository.get(setId).then((existing) => {
      if (existing) {
        setTitle(existing.title);
        setDescription(existing.description);
        setTags(existing.tags);
        setVisibility(existing.visibility);
        setProblems(existing.problems);
      }
      setLoaded(true);
    });
  }, [setId]);

  const runSearch = useCallback(async () => {
    const band = DIFFICULTY_BANDS[bandIndex] ?? DIFFICULTY_BANDS[0]!;
    const id = ++requestId.current;
    setSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ q: term, limit: "20" });
      if (band.min !== null) params.set("difficultyMin", String(band.min));
      if (band.max !== null) params.set("difficultyMax", String(band.max));
      const response = await fetch(`/api/problems/search?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("検索に失敗しました");
      const body = (await response.json()) as ProblemSearchResponse;
      // 遅れて届いた古い検索結果で上書きしない。
      if (id === requestId.current) setResults(body);
    } catch {
      if (id === requestId.current) setSearchError("問題を検索できませんでした。もう一度お試しください。");
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, [term, bandIndex]);

  // 入力が止まってから検索する。
  useEffect(() => {
    const timer = window.setTimeout(() => void runSearch(), 250);
    return () => window.clearTimeout(timer);
  }, [runSearch]);

  function toggleTag(tag: ProblemSetTag) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 6),
    );
  }

  function addProblem(problem: CatalogProblem) {
    setProblems((current) =>
      current.some((item) => item.problemId === problem.problemId) ? current : [...current, problem],
    );
  }

  function removeProblem(problemId: string) {
    setProblems((current) => current.filter((item) => item.problemId !== problemId));
  }

  function move(index: number, delta: number) {
    setProblems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const moved = next[index]!;
      next[index] = next[target]!;
      next[target] = moved;
      return next;
    });
  }

  async function save(status: "draft" | "published") {
    if (!title.trim()) {
      setNotice("タイトルを入力してください。");
      return;
    }
    if (status === "published" && problems.length === 0) {
      setNotice("保存するには問題を1問以上追加してください。下書き保存はできます。");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const existing = setId ? await problemSetRepository.get(setId) : null;
    const set: ProblemSet = {
      setId: setId ?? newProblemSetId(),
      title: title.trim(),
      description: description.trim(),
      tags,
      visibility,
      status,
      problems,
      authorName: existing?.authorName ?? CURRENT_AUTHOR,
      likeCount: existing?.likeCount ?? 0,
      useCount: existing?.useCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await problemSetRepository.save(set);
    setSaving(false);
    router.push(`/sets/${set.setId}`);
  }

  if (!loaded) return <p className="practice-loading">読み込み中…</p>;

  const range = difficultyRangeOf(problems);
  const added = new Set(problems.map((problem) => problem.problemId));

  return (
    <div className="practice-page">
      <div className="practice-page-head">
        <div>
          <h1>{setId ? "問題セットを編集" : "問題セットを作成"}</h1>
          <p className="practice-lead">
            Problems上の問題を正データとして検索し、ヒットを1件ずつ追加します。ランダム生成は行いません。
          </p>
        </div>
        <div className="reaction-row">
          <button className="practice-button" type="button" disabled={saving} onClick={() => void save("draft")}>
            下書き保存
          </button>
          <button
            className="practice-button is-primary"
            type="button"
            disabled={saving}
            onClick={() => void save("published")}
          >
            保存する
          </button>
        </div>
      </div>

      {notice && <p className="practice-notice">{notice}</p>}

      <div className="create-layout">
        <div>
          <section className="create-block">
            <label className="ps-field-label" htmlFor="set-title">
              問題セットタイトル
            </label>
            <input
              className="practice-input"
              id="set-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="DP入門セット"
              maxLength={60}
            />

            <label className="ps-field-label" htmlFor="set-description">
              説明
            </label>
            <textarea
              className="practice-textarea"
              id="set-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="どんな人に向けたセットか、何が身につくかを書きます。"
              maxLength={400}
            />
          </section>

          <section className="create-block">
            <h2>タグ（押して有効化）</h2>
            <div className="filter-tags">
              {PROBLEM_SET_TAGS.map((tag) => (
                <TagPill key={tag} tag={tag} selected={tags.includes(tag)} onToggle={() => toggleTag(tag)} />
              ))}
            </div>
            <p className="ps-field-help">事前に用意したタグから選びます。最大6個。</p>
          </section>

          <section className="create-block">
            <h2>Problems を検索して追加</h2>
            <div className="search-controls">
              <input
                className="practice-input"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="問題名・番号・タグで検索（例: EDPC, ABC300 C, 典型90）"
                aria-label="問題を検索"
              />
              <select
                className="practice-select"
                value={bandIndex}
                onChange={(event) => setBandIndex(Number(event.target.value))}
                aria-label="Difficulty帯"
              >
                {DIFFICULTY_BANDS.map((band, index) => (
                  <option key={band.label} value={index}>
                    {band.label}
                  </option>
                ))}
              </select>
            </div>

            {searchError && <p className="practice-notice">{searchError}</p>}
            {searching && <p className="ps-field-help">検索中…</p>}
            {results && !searching && (
              <p className="ps-field-help">
                {results.total}件が一致（上位{results.problems.length}件を表示）
              </p>
            )}

            <div className="search-results">
              {results?.problems.map((problem) => (
                <div className="search-row" key={problem.problemId}>
                  <span className="search-row-title">{problem.title}</span>
                  <span className="problem-source search-row-source">{problem.source}</span>
                  <DifficultyDot difficulty={problem.difficulty} />
                  <button
                    className="practice-button is-small"
                    type="button"
                    disabled={added.has(problem.problemId)}
                    onClick={() => addProblem(problem)}
                  >
                    {added.has(problem.problemId) ? "✓ 追加済み" : "＋ 追加"}
                  </button>
                </div>
              ))}
              {results && results.problems.length === 0 && !searching && (
                <p className="practice-loading">一致する問題がありません。条件を緩めてください。</p>
              )}
            </div>
          </section>

          <section className="create-block">
            <div className="ps-section-heading">
              <h2>追加済み（{problems.length}問）</h2>
              <span className="ps-section-note">並び替え可</span>
            </div>
            {problems.length === 0 ? (
              <p className="ps-field-help">上の検索から問題を追加してください。</p>
            ) : (
              <div className="added-list">
                {problems.map((problem, index) => (
                  <div className="added-row" key={problem.problemId}>
                    <span className="drag-handle" aria-hidden="true">
                      ⠿
                    </span>
                    <span className="problem-title">
                      {problem.title} <span className="problem-source">{problem.source}</span>
                    </span>
                    <DifficultyDot difficulty={problem.difficulty} />
                    <span>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`${problem.title}を上へ`}
                      >
                        ↑
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === problems.length - 1}
                        aria-label={`${problem.title}を下へ`}
                      >
                        ↓
                      </button>
                    </span>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => removeProblem(problem.problemId)}
                      aria-label={`${problem.title}を削除`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="create-summary">
          <h2>このセットの状態</h2>
          <dl>
            <div className="summary-row">
              <dt>問題数</dt>
              <dd>{problems.length}問</dd>
            </div>
            <div className="summary-row">
              <dt>Difficulty</dt>
              <dd>
                <DifficultyRangeChip range={range} />
              </dd>
            </div>
            <div className="summary-row">
              <dt>想定時間</dt>
              <dd>約{estimateMinutes(problems)}分</dd>
            </div>
            <div className="summary-row">
              <dt>タグ</dt>
              <dd>{tags.length > 0 ? tags.join(" / ") : "未選択"}</dd>
            </div>
          </dl>

          <div>
            <span className="ps-field-label">公開範囲</span>
            <div className="segmented">
              {visibilitySchema.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={visibility === option}
                  onClick={() => setVisibility(option)}
                >
                  {VISIBILITY_LABEL[option]}
                </button>
              ))}
            </div>
            <p className="ps-field-help">
              認証がないため、この段階では公開範囲による閲覧制限は実際には効きません。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
