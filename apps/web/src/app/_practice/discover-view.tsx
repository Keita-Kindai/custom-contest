"use client";

import { useMemo, useState } from "react";

import {
  DIFFICULTY_BANDS,
  PROBLEM_SET_SORT_LABEL,
  orderedTargetBands,
  type BandKey,
  type DiscoverQuery,
  type ProblemSetSort,
  type ProblemSetTag,
} from "@custom-contest/contracts";

import { EmptyState, SetCard, TagPill } from "./components/atoms";
import { problemSetRepository } from "./data/repository";
import { usePracticeData } from "./use-practice-data";

/** Discoverで前に出すタグ。全タグはフィルターから選べる。 */
const QUICK_TAGS: ProblemSetTag[] = ["DP", "グラフ", "数学", "典型90", "初級", "短時間"];

export function DiscoverView() {
  const [draftQuery, setDraftQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [tags, setTags] = useState<ProblemSetTag[]>([]);
  const [bands, setBands] = useState<BandKey[]>([]);
  const [sort, setSort] = useState<ProblemSetSort>("popular");

  // 検索語かタグが入ったら、特集グリッドから結果一覧へ切り替える（13章）。
  const searching = keyword.trim() !== "" || tags.length > 0 || bands.length > 0;

  const query = useMemo<DiscoverQuery>(
    () => ({ q: keyword, tags, bands, sort, difficultyMin: null, difficultyMax: null }),
    [keyword, tags, bands, sort],
  );

  const results = usePracticeData(() => problemSetRepository.discover(query), [query]);
  const fresh = usePracticeData(() => problemSetRepository.featured("new"), []);
  const loved = usePracticeData(() => problemSetRepository.featured("liked"), []);

  function toggleTag(tag: ProblemSetTag) {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function toggleBand(band: BandKey) {
    setBands((current) =>
      current.includes(band) ? current.filter((item) => item !== band) : [...current, band],
    );
  }

  function clearAll() {
    setTags([]);
    setBands([]);
    setKeyword("");
    setDraftQuery("");
  }

  return (
    <div className="practice-page">
      <div className="practice-page-head">
        <div>
          <h1>Discover</h1>
          <p className="practice-lead">レベル別に選びやすい問題セットを探せます。</p>
        </div>
      </div>

      <section className="filter-bar" aria-label="検索とフィルター">
        <form
          className="filter-search"
          onSubmit={(event) => {
            event.preventDefault();
            setKeyword(draftQuery);
          }}
        >
          <label className="ps-field-label" htmlFor="discover-search">
            検索
          </label>
          <input
            className="practice-input"
            id="discover-search"
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="セット・作成者・タグで検索"
          />
          <button className="practice-button is-primary" type="submit">
            検索
          </button>
        </form>

        <div className="filter-tags">
          <TagPill tag="すべて" selected={tags.length === 0} onToggle={() => setTags([])} />
          {QUICK_TAGS.map((tag) => (
            <TagPill key={tag} tag={tag} selected={tags.includes(tag)} onToggle={() => toggleTag(tag)} />
          ))}
        </div>

        <div className="band-filter">
          <span className="ps-field-label">対象者で絞る</span>
          <div className="band-filter-dots">
            {DIFFICULTY_BANDS.map((band) => (
              <button
                key={band.key}
                type="button"
                className={`band-filter-dot ps-diff-${band.key}${bands.includes(band.key) ? " is-selected" : ""}`}
                aria-pressed={bands.includes(band.key)}
                aria-label={`${band.label}を対象にしたセットで絞る`}
                title={band.label}
                onClick={() => toggleBand(band.key)}
              />
            ))}
          </div>
          {bands.length > 0 && (
            <button className="band-filter-clear" type="button" onClick={() => setBands([])}>
              {orderedTargetBands(bands)
                .map((band) => band.label)
                .join("・")}
              を選択中 <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        {searching && (
          <div className="applied-filters">
            <span>適用中:</span>
            {keyword && <span className="tag-pill is-small">「{keyword}」</span>}
            {tags.map((tag) => (
              <span className="tag-pill is-small" key={tag}>
                {tag}
              </span>
            ))}
            <button type="button" onClick={clearAll}>
              すべて解除
            </button>
          </div>
        )}
      </section>

      {searching ? (
        <section aria-label="検索結果">
          <div className="ps-section-heading">
            <h2>
              {keyword ? `「${keyword}」の検索結果` : "検索結果"}
              <span className="ps-section-note"> {results.data?.length ?? 0}件</span>
            </h2>
            <label className="ps-section-note">
              並び替え{" "}
              <select
                className="practice-select"
                style={{ width: "auto", display: "inline-block", padding: "4px 8px" }}
                value={sort}
                onChange={(event) => setSort(event.target.value as ProblemSetSort)}
              >
                {Object.entries(PROBLEM_SET_SORT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {results.loading && <p className="practice-loading">読み込み中…</p>}
          {!results.loading && (results.data?.length ?? 0) === 0 && (
            <EmptyState
              title="条件に合う問題セットがありません"
              hint="タグを減らすか、キーワードを短くしてください。"
            />
          )}
          {!results.loading && (results.data?.length ?? 0) > 0 && (
            <div className="set-grid is-featured">
              {results.data?.map((summary) => (
                <SetCard key={summary.setId} summary={summary} variant="featured" />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section aria-label="新着の問題セット">
            <div className="ps-section-heading">
              <h2>新着の問題セット</h2>
              <span className="ps-section-note">最近更新されたセット</span>
            </div>
            <div className="set-grid is-featured">
              {fresh.data?.map((summary) => (
                <SetCard key={summary.setId} summary={summary} variant="featured" />
              ))}
            </div>
          </section>

          <section aria-label="いいね数が多い問題セット">
            <div className="ps-section-heading">
              <h2>いいね数が多い問題セット</h2>
              <span className="ps-section-note">よく使われているセット</span>
            </div>
            <div className="set-grid">
              {loved.data?.map((summary) => (
                <SetCard key={summary.setId} summary={summary} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
