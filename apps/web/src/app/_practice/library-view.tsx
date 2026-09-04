"use client";

import Link from "next/link";
import { useState } from "react";

import { LIBRARY_TAB_LABEL, libraryTabSchema, type LibraryTab } from "@custom-contest/contracts";

import { EmptyState, SetCard } from "./components/atoms";
import { problemSetRepository } from "./data/repository";
import { usePracticeData } from "./use-practice-data";

const EMPTY_HINT: Record<LibraryTab, { title: string; hint: string }> = {
  created: { title: "まだ問題セットを作っていません", hint: "「作る」からProblemsを検索して作成できます。" },
  bookmarked: { title: "ブックマークがありません", hint: "セット詳細の「▣ 保存」で後から見返せます。" },
  liked: { title: "いいねしたセットがありません", hint: "セット詳細の「♡」で記録されます。" },
  recent: { title: "最近開いたセットがありません", hint: "Discoverからセットを開くとここに並びます。" },
};

export function LibraryView() {
  const [tab, setTab] = useState<LibraryTab>("created");
  const counts = usePracticeData(() => problemSetRepository.counts(), []);
  const sets = usePracticeData(() => problemSetRepository.library(tab), [tab]);

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
          {!sets.loading && (sets.data?.length ?? 0) > 0 && (
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
        </div>
      </div>
    </div>
  );
}
