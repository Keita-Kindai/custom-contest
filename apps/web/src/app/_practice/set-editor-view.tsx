"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DIFFICULTY_BANDS,
  MAX_PROBLEMS_PER_SET,
  PROBLEM_SET_TAGS,
  VISIBILITY_HELP,
  VISIBILITY_LABEL,
  difficultyRangeOf,
  problemSetInputSchema,
  visibilitySchema,
  type BandKey,
  type CatalogProblem,
  type ProblemSearchResponse,
  type ProblemSetInput,
  type ProblemSetTag,
  type Visibility,
} from "@custom-contest/contracts";

import {
  DifficultyDot,
  DifficultyRangeChip,
  ProblemTitleLink,
  TagPill,
  TargetBandDots,
} from "./components/atoms";
import { ApiError, newProblemSetId, problemSetRepository } from "./data/repository";

/** Diff帯のプリセット。検索の絞り込みに使う。 */
const DIFFICULTY_BANDS_FILTER: { label: string; min: number | null; max: number | null }[] = [
  { label: "Diff 帯", min: null, max: null },
  ...DIFFICULTY_BANDS.map((band, index) => ({
    label: `${band.from}–${Number.isFinite(band.max) ? band.max : ""} ${band.label}`,
    min: index === 0 ? null : band.from,
    max: Number.isFinite(band.max) ? band.max : null,
  })),
];

const PAGE_SIZES = [20, 50, 100];

/**
 * 左の列の見出しへ飛ぶための並び。左から順に並べる。
 * 「追加済み」はこの並び自身が入っているカードなので、行き先に入れない。
 */
const SECTIONS = [
  { id: "set-title", label: "タイトル" },
  { id: "set-tags", label: "タグ" },
  { id: "set-bands", label: "想定者" },
  { id: "set-search", label: "問題検索" },
] as const;

export function SetEditorView({ setId }: { setId?: string }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<ProblemSetTag[]>([]);
  const [targetBands, setTargetBands] = useState<BandKey[]>([]);
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [problems, setProblems] = useState<CatalogProblem[]>([]);
  const [loaded, setLoaded] = useState(setId === undefined);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [askVisibility, setAskVisibility] = useState(false);
  /** モーダルの中で選んでいる公開範囲。保存を押すまで確定しない。 */
  const [visibilityDraft, setVisibilityDraft] = useState<Visibility>("public");
  /** ドラッグ中の行。⠿ を掴んだときだけ立てて、行全体が勝手に動かないようにする。 */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /**
   * 離したときに差し込む位置。行番号ではなく行と行のすきまを指す。
   * 0は先頭の前、`problems.length`は末尾の後。
   */
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  const [term, setTerm] = useState("");
  const [bandIndex, setBandIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
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
        setTargetBands(existing.targetBands);
        setVisibility(existing.visibility);
        setProblems(existing.problems);
      }
      setLoaded(true);
    });
  }, [setId]);

  const runSearch = useCallback(async () => {
    const band = DIFFICULTY_BANDS_FILTER[bandIndex] ?? DIFFICULTY_BANDS_FILTER[0]!;
    const id = ++requestId.current;
    setSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({
        q: term,
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
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
  }, [term, bandIndex, pageSize, page]);

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

  function toggleBand(key: BandKey) {
    setTargetBands((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function addProblem(problem: CatalogProblem) {
    if (problems.some((item) => item.problemId === problem.problemId)) return;
    if (problems.length >= MAX_PROBLEMS_PER_SET) {
      setNotice(`1セットに入れられるのは${MAX_PROBLEMS_PER_SET}問までです。`);
      return;
    }
    setNotice(null);
    setProblems((current) => [...current, problem]);
  }

  /**
   * 表示中のページのうち、まだ入っていないものをまとめて入れる。
   * 1ページは最大100件だが、セットの上限は`MAX_PROBLEMS_PER_SET`問なので、そこで打ち切る。
   */
  function addPage() {
    const known = new Set(problems.map((item) => item.problemId));
    const fresh = (results?.problems ?? []).filter((problem) => !known.has(problem.problemId));
    const room = MAX_PROBLEMS_PER_SET - problems.length;
    setNotice(
      fresh.length > room
        ? `1セットに入れられるのは${MAX_PROBLEMS_PER_SET}問までです。${room}問だけ追加しました。`
        : null,
    );
    if (room <= 0) return;
    setProblems((current) => [...current, ...fresh.slice(0, room)]);
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

  /**
   * ドラッグした行を、線が出ているすきまへ差し込む。入れ替えではなく挿入で並べ替える。
   * `slot`は行と行のあいだを指すので、自分より後ろへ動かすときは自分が抜けた分だけ前へ寄せる。
   */
  function reorderToSlot(from: number, slot: number) {
    setProblems((current) => {
      if (from < 0 || from >= current.length) return current;
      const to = slot > from ? slot - 1 : slot;
      if (to === from) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  async function save(status: "draft" | "published", chosen?: Visibility) {
    if (!title.trim()) {
      setNotice("タイトルを入力してください。");
      return;
    }
    if (status === "published" && problems.length === 0) {
      setNotice("保存するには問題を1問以上追加してください。下書き保存はできます。");
      return;
    }
    // 公開範囲は保存する瞬間に選ぶ。下書きは選ばせず非公開のままにする。
    const decided = chosen ?? (status === "draft" ? (visibility ?? "private") : visibility);
    if (status === "published" && decided === null) {
      setVisibilityDraft(visibility ?? "public");
      setAskVisibility(true);
      return;
    }
    setSaving(true);
    setAskVisibility(false);
    // 作成者・いいね数・時刻はserverが決めるので送らない。
    const input: ProblemSetInput = {
      setId: setId ?? newProblemSetId(),
      title: title.trim(),
      description: description.trim(),
      tags,
      targetBands,
      visibility: decided ?? "private",
      status,
      problems,
    };
    // 送る前に契約どおりの形かを確かめる。問題数の上限のような制約は、
    // 画面側で防いでいてもここが最後の関門になる。
    const parsed = problemSetInputSchema.safeParse(input);
    if (!parsed.success) {
      setSaving(false);
      setNotice("保存できない内容が含まれています。問題数やタイトルの長さを確認してください。");
      return;
    }
    try {
      const saved = await problemSetRepository.save(parsed.data);
      router.push(`/sets/${saved.setId}`);
    } catch (error) {
      setSaving(false);
      setNotice(error instanceof ApiError ? error.message : "保存できませんでした。");
    }
  }

  if (!loaded) return <p className="practice-loading">読み込み中…</p>;

  const range = difficultyRangeOf(problems);
  const added = new Set(problems.map((problem) => problem.problemId));
  const total = results?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageProblems = results?.problems ?? [];
  const allOnPageAdded = pageProblems.length > 0 && pageProblems.every((p) => added.has(p.problemId));

  return (
    <div className="practice-page">
      <div className="practice-page-head">
        <div>
          <h1>{setId ? "問題セットを編集" : "問題セットを作成"}</h1>
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

      {askVisibility && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAskVisibility(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="visibility-modal-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") setAskVisibility(false);
            }}
          >
            <h2 className="modal-title" id="visibility-modal-title">
              公開範囲を選ぶ
            </h2>
            <p className="modal-lead">あとから設定を変更できます。</p>

            <div className="visibility-options">
              {visibilitySchema.options.map((option) => (
                <label
                  className={`visibility-option${visibilityDraft === option ? " is-selected" : ""}`}
                  key={option}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option}
                    checked={visibilityDraft === option}
                    onChange={() => setVisibilityDraft(option)}
                  />
                  <span className="visibility-option-body">
                    <span className="visibility-option-label">{VISIBILITY_LABEL[option]}</span>
                    <span className="visibility-option-help">{VISIBILITY_HELP[option]}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="ps-field-help">
              認証がないため、この段階では公開範囲による閲覧制限は実際には効きません。
            </p>

            <div className="modal-actions">
              <button className="practice-button is-quiet" type="button" onClick={() => setAskVisibility(false)}>
                キャンセル
              </button>
              <button
                className="practice-button is-primary"
                type="button"
                disabled={saving}
                onClick={() => void save("published", visibilityDraft)}
              >
                この内容で保存
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="create-layout">
        <div>
          <section className="create-block" id="set-title">
            <label className="ps-field-label" htmlFor="set-title-input">
              問題セットタイトル
            </label>
            <input
              className="practice-input"
              id="set-title-input"
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

          <section className="create-block" id="set-tags">
            <h2>タグ（押して有効化）</h2>
            <div className="filter-tags">
              {PROBLEM_SET_TAGS.map((tag) => (
                <TagPill key={tag} tag={tag} selected={tags.includes(tag)} onToggle={() => toggleTag(tag)} />
              ))}
            </div>
            <p className="ps-field-help">事前に用意したタグから選びます。最大6個。</p>
          </section>

          <section className="create-block" id="set-bands">
            <h2>想定者（押して有効化・複数可）</h2>
            <div className="band-picker">
              {DIFFICULTY_BANDS.map((band) => (
                <button
                  key={band.key}
                  type="button"
                  className={`band-chip ps-diff-${band.key}${targetBands.includes(band.key) ? " is-selected" : ""}`}
                  aria-pressed={targetBands.includes(band.key)}
                  onClick={() => toggleBand(band.key)}
                >
                  <span className="band-chip-dot" aria-hidden="true" />
                  <span className="band-chip-name">
                    {targetBands.includes(band.key) && <span aria-hidden="true">✓ </span>}
                    {band.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="ps-field-help">
              誰に向けたセットかを選びます。複数選べます。選んだ色はそのままカードに並びます。
            </p>
          </section>

          <section className="create-block" id="set-search">
            <h2>Problems を検索して追加</h2>
            <div className="search-controls">
              <input
                className="practice-input"
                type="search"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="問題名・番号・タグで検索（例: EDPC, ABC300 C, 典型90）"
                aria-label="問題を検索"
              />
              <select
                className="practice-select"
                value={bandIndex}
                onChange={(event) => {
                  setBandIndex(Number(event.target.value));
                  setPage(1);
                }}
                aria-label="Difficulty帯"
              >
                {DIFFICULTY_BANDS_FILTER.map((band, index) => (
                  <option key={band.label} value={index}>
                    {band.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="search-toolbar">
              <label className="ps-section-note">
                表示件数{" "}
                <select
                  className="practice-select is-inline"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      上位{size}件
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="practice-button is-primary is-small"
                type="button"
                onClick={addPage}
                disabled={pageProblems.length === 0 || allOnPageAdded}
              >
                {allOnPageAdded ? "✓ このページは追加済み" : "＋ このページを一括追加"}
              </button>
              <Pager page={page} pageCount={pageCount} onChange={setPage} />
            </div>

            {searchError && <p className="practice-notice">{searchError}</p>}
            <p className="ps-field-help">
              {searching
                ? "検索中…"
                : `${total}件が一致（${total === 0 ? 0 : (page - 1) * pageSize + 1}–${(page - 1) * pageSize + pageProblems.length}件目を表示）`}
            </p>

            <div className="search-results">
              <div className="search-row is-head" aria-hidden="true">
                <span>問題</span>
                <span>Diff</span>
                <span />
              </div>
              {pageProblems.map((problem) => (
                <div className="search-row" key={problem.problemId}>
                  <span className="search-row-title">
                    <ProblemTitleLink
                      problemId={problem.problemId}
                      contestId={problem.contestId}
                      title={problem.title}
                    />
                    <span className="problem-source">{problem.source}</span>
                  </span>
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
              {results && pageProblems.length === 0 && !searching && (
                <p className="practice-loading">一致する問題がありません。条件を緩めてください。</p>
              )}
            </div>

            <div className="search-toolbar is-foot">
              <Pager page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </section>
        </div>

        <aside className="create-summary" id="set-added">
          <div className="ps-section-heading">
            <h2>追加済み（{problems.length}問）</h2>
            <span className="ps-section-note">⠿ を掴んで並び替え</span>
          </div>

          {problems.length === 0 ? (
            <p className="ps-field-help">左の検索から問題を追加してください。</p>
          ) : (
            <div className="added-list">
              {problems.map((problem, index) => (
                <div
                  // 1本のすきまに線が二重に出ないよう、末尾のうしろだけ`is-drop-after`で描く。
                  className={`added-row${dropSlot === index ? " is-drop-before" : ""}${
                    dropSlot === problems.length && index === problems.length - 1 ? " is-drop-after" : ""
                  }`}
                  key={problem.problemId}
                  draggable={dragIndex === index}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    // Firefoxはデータを載せないとdragを開始しない。
                    event.dataTransfer.setData("text/plain", problem.problemId);
                  }}
                  onDragOver={(event) => {
                    if (dragIndex === null) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    // 行の上半分なら手前のすきま、下半分なら次のすきまへ線を出す。
                    const box = event.currentTarget.getBoundingClientRect();
                    setDropSlot(event.clientY < box.top + box.height / 2 ? index : index + 1);
                  }}
                  onDrop={(event) => {
                    if (dragIndex === null || dropSlot === null) return;
                    event.preventDefault();
                    reorderToSlot(dragIndex, dropSlot);
                    setDragIndex(null);
                    setDropSlot(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropSlot(null);
                  }}
                >
                  {/*
                   * 掴んで並べ替える取っ手。マウスでは⠿からのdragだけを許可し、
                   * キーボードでは上下キーで同じ並べ替えができるようにしてある。
                   */}
                  <button
                    className="drag-handle"
                    type="button"
                    aria-label={`${problem.title}の並び順（上下キーで移動）`}
                    onMouseDown={() => setDragIndex(index)}
                    onMouseUp={() => setDragIndex(null)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        move(index, -1);
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        move(index, 1);
                      }
                    }}
                  >
                    <span aria-hidden="true">⠿</span>
                  </button>
                  <span className="problem-title is-single-line" title={problem.title}>
                    <ProblemTitleLink
                      problemId={problem.problemId}
                      contestId={problem.contestId}
                      title={problem.title}
                    />
                  </span>
                  <DifficultyDot difficulty={problem.difficulty} />
                  <button
                    className="icon-button is-bare"
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

          <dl className="summary-facts">
            <div className="summary-row">
              <dt>Difficulty</dt>
              <dd>
                <DifficultyRangeChip range={range} />
              </dd>
            </div>
            <div className="summary-row">
              <dt>想定者</dt>
              <dd>
                <TargetBandDots bands={targetBands} />
              </dd>
            </div>
            <div className="summary-row">
              <dt>公開範囲</dt>
              <dd>{visibility === null ? "未設定（保存時に選択）" : VISIBILITY_LABEL[visibility]}</dd>
            </div>
          </dl>

          {/* 見出しへの近道。左の列を上下に往復せずに済むよう、常に見えるこのカードの中に置く。 */}
          <nav className="section-jump" aria-label="このページの項目">
            <span className="section-jump-title">このページの項目</span>
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

/** ページ送り。端は常に出し、間は現在地の前後だけを出す。 */
function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (next: number) => void;
}) {
  if (pageCount <= 1) return null;
  const shown = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const pages = [...shown].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);

  return (
    <div className="pager" role="navigation" aria-label="検索結果のページ">
      <button
        className="icon-button"
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="前のページ"
      >
        ‹
      </button>
      {pages.map((value, index) => (
        <span key={value}>
          {index > 0 && value - pages[index - 1]! > 1 && <span className="pager-gap">…</span>}
          <button
            className={`pager-page${value === page ? " is-current" : ""}`}
            type="button"
            aria-current={value === page ? "page" : undefined}
            onClick={() => onChange(value)}
          >
            {value}
          </button>
        </span>
      ))}
      <button
        className="icon-button"
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        aria-label="次のページ"
      >
        ›
      </button>
    </div>
  );
}
