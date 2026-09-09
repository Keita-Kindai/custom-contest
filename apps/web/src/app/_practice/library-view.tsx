"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  LIBRARY_TAB_LABEL,
  SET_PROGRESS_LABEL,
  SET_PROGRESS_ORDER,
  libraryTabSchema,
  setProgressOf,
  type LibraryTab,
  type ProblemSetSummary,
  type SetSolveStatusMap,
} from "@custom-contest/contracts";

import { EmptyState, SetCard } from "./components/atoms";
import { problemSetRepository } from "./data/repository";
import { usePracticeData } from "./use-practice-data";

const EMPTY_HINT: Record<LibraryTab, { title: string; hint: string }> = {
  created: { title: "まだ問題セットを作っていません", hint: "「作る」からProblemsを検索して作成できます。" },
  bookmarked: { title: "保存したセットがありません", hint: "セット詳細の「▣ 保存」で後から見返せます。" },
  liked: { title: "いいねしたセットがありません", hint: "セット詳細の「♡」で記録されます。" },
  recent: { title: "最近開いたセットがありません", hint: "Discoverからセットを開くとここに並びます。" },
};

export function LibraryView() {
  const [tab, setTab] = useState<LibraryTab>("created");
  const [grouped, setGrouped] = useState(false);
  const [statuses, setStatuses] = useState<SetSolveStatusMap>({});
  const counts = usePracticeData(() => problemSetRepository.counts(), []);
  const sets = usePracticeData(() => problemSetRepository.library(tab), [tab]);

  useEffect(() => {
    void problemSetRepository.allSolveStatuses().then(setStatuses);
  }, []);

  /** 進み具合ごとの束。全てAC・進行中・未着手のどれに入るかは挑戦状態から決める。 */
  function groupsOf(summaries: ProblemSetSummary[]) {
    return SET_PROGRESS_ORDER.map((progress) => ({
      progress,
      summaries: summaries.filter(
        (summary) => setProgressOf(summary.problemIds, statuses[summary.setId] ?? {}) === progress,
      ),
    })).filter((group) => group.summaries.length > 0);
  }

  return (
    <div className="practice-page">
      <div className="practice-page-head">
        <div>
          <h1>マイページ</h1>
          <p className="practice-lead">作成・保存したセットはこの端末のブラウザーに保存されます。</p>
        </div>
        <Link className="practice-button is-primary" href="/sets/new">
          問題セットを作る
        </Link>
      </div>

      <dl className="library-stats">
        {libraryTabSchema.options.map((key) => (
          <div className="library-stat" key={key}>
            <dt>{LIBRARY_TAB_LABEL[key]}</dt>
            <dd>{counts.data?.[key] ?? 0}</dd>
          </div>
        ))}
      </dl>

      <div>
        <div className="library-toolbar">
          <button
            className={`practice-button is-small${grouped ? " is-active" : ""}`}
            type="button"
            aria-pressed={grouped}
            onClick={() => setGrouped((current) => !current)}
          >
            進み具合で分ける
          </button>
        </div>

        <div className="library-tabs" role="tablist" aria-label="ライブラリの分類">
          {libraryTabSchema.options.map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              className="library-tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {LIBRARY_TAB_LABEL[key]}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: "var(--space-5)" }}>
          {sets.loading && <p className="practice-loading">読み込み中…</p>}
          {!sets.loading && (sets.data?.length ?? 0) === 0 && (
            <EmptyState title={EMPTY_HINT[tab].title} hint={EMPTY_HINT[tab].hint} />
          )}
          {!sets.loading && (sets.data?.length ?? 0) > 0 && !grouped && (
            <div className="set-grid">
              {sets.data?.map((summary) => (
                <SetCard
                  key={summary.setId}
                  summary={summary}
                  showVisibility={tab === "created"}
                />
              ))}
            </div>
          )}
          {!sets.loading && (sets.data?.length ?? 0) > 0 && grouped && (
            <div className="library-groups">
              {groupsOf(sets.data ?? []).map((group) => (
                <section key={group.progress} aria-label={SET_PROGRESS_LABEL[group.progress]}>
                  <div className="ps-section-heading">
                    <h2>{SET_PROGRESS_LABEL[group.progress]}</h2>
                    <span className="ps-section-note">{group.summaries.length}件</span>
                  </div>
                  <div className="set-grid">
                    {group.summaries.map((summary) => (
                      <SetCard
                        key={summary.setId}
                        summary={summary}
                        showVisibility={tab === "created"}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
