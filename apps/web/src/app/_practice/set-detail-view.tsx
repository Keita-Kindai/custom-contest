"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  VISIBILITY_LABEL,
  difficultyRangeOf,
  type ProblemSet,
  type SolveStatus,
  type SolveStatusMap,
} from "@custom-contest/contracts";

import {
  DifficultyDot,
  DifficultyRangeChip,
  EmptyState,
  ProblemTitleLink,
  SolveStatusControl,
  SolveStatusLegend,
  TagPill,
  TargetBandDots,
} from "./components/atoms";
import { SetDetailSkeleton } from "./components/skeletons";
import { problemSetRepository, type ViewerState } from "./data/repository";
import { usePracticeData } from "./use-practice-data";

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  return `${days}日前`;
}

export function SetDetailView({ setId }: { setId: string }) {
  const { data, loading } = usePracticeData(() => problemSetRepository.get(setId), [setId]);
  const [viewer, setViewer] = useState<ViewerState>({
    isOwner: false,
    liked: false,
    bookmarked: false,
  });
  const [shareStatus, setShareStatus] = useState("共有");
  const [solveStatuses, setSolveStatuses] = useState<SolveStatusMap>({});

  useEffect(() => {
    void problemSetRepository.viewerState(setId).then(setViewer);
    void problemSetRepository.solveStatuses(setId).then(setSolveStatuses);
    void problemSetRepository.markRecent(setId);
  }, [setId]);

  function changeSolveStatus(problemId: string, next: SolveStatus) {
    void problemSetRepository.setSolveStatus(setId, problemId, next).then(setSolveStatuses);
  }

  if (loading) return <SetDetailSkeleton />;
  if (!data) {
    return (
      <EmptyState
        title="この問題セットは見つかりません"
        hint="URLを確認するか、Discoverから探し直してください。非公開のセットは作成者だけが開けます。"
      />
    );
  }

  const set: ProblemSet = data;
  const range = difficultyRangeOf(set.problems);
  const { isOwner, liked, bookmarked } = viewer;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sets/${setId}`);
      setShareStatus("リンクをコピーしました");
    } catch {
      setShareStatus("URL欄からコピーしてください");
    }
    window.setTimeout(() => setShareStatus("共有"), 2200);
  }

  return (
    <div className="practice-page">
      <div className="set-detail">
        <div>
          <div className="set-detail-tags">
            {set.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
            {set.status === "draft" && <span className="visibility-pill is-draft">下書き</span>}
          </div>

          <h1>{set.title}</h1>
          {set.description && <p className="practice-lead">{set.description}</p>}

          <dl className="set-detail-facts">
            <div>
              <dt>Difficulty</dt>
              <dd>
                <DifficultyRangeChip range={range} />
              </dd>
            </div>
            <div>
              <dt>問題数</dt>
              <dd>{set.problems.length}問</dd>
            </div>
            <div>
              <dt>想定者</dt>
              <dd>
                <TargetBandDots bands={set.targetBands} />
              </dd>
            </div>
          </dl>

          <div className="ps-section-heading">
            <h2>収録問題</h2>
            <span className="ps-section-note">問題名を押すとAtCoderで開きます</span>
          </div>

          {set.problems.length === 0 ? (
            <EmptyState title="まだ問題がありません" hint="編集画面からProblemsを検索して追加できます。" />
          ) : (
            <div className="problem-list">
              {set.problems.map((problem, index) => {
                const status = solveStatuses[problem.problemId] ?? "unsolved";
                return (
                  <div className={`problem-list-row is-${status}`} key={problem.problemId}>
                    <span className="problem-index">{index + 1}</span>
                    <span className="problem-title">
                      <ProblemTitleLink
                        problemId={problem.problemId}
                        contestId={problem.contestId}
                        title={problem.title}
                      />
                    </span>
                    <span className="problem-source">{problem.source}</span>
                    <DifficultyDot difficulty={problem.difficulty} />
                    <SolveStatusControl
                      status={status}
                      problemTitle={problem.title}
                      compact
                      onChange={(next) => changeSolveStatus(problem.problemId, next)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="set-detail-side">
          <div className="side-actions">
            <button className="practice-button is-primary" type="button" disabled>
              このセットで練習する
            </button>
            <p className="ps-field-help">練習画面は次のフェーズで作ります。</p>
          </div>

          <div className="reaction-row">
            <button
              className={`practice-button is-small${liked ? " is-active" : ""}`}
              type="button"
              aria-pressed={liked}
              onClick={() =>
                void problemSetRepository
                  .toggleLike(setId)
                  .then((next) => setViewer((current) => ({ ...current, liked: next })))
              }
            >
              <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {set.likeCount}
            </button>
            <button
              className={`practice-button is-small${bookmarked ? " is-active" : ""}`}
              type="button"
              aria-pressed={bookmarked}
              onClick={() =>
                void problemSetRepository
                  .toggleBookmark(setId)
                  .then((next) => setViewer((current) => ({ ...current, bookmarked: next })))
              }
            >
              <span aria-hidden="true">▣</span> {bookmarked ? "保存済み" : "保存"}
            </button>
          </div>

          <button className="practice-button is-small" type="button" onClick={() => void copyShareLink()}>
            {shareStatus}
          </button>

          {isOwner && (
            <Link className="practice-button is-small" href={`/sets/${setId}/edit`}>
              このセットを編集
            </Link>
          )}

          <div className="side-legend">
            <span className="ps-field-label">行の色の意味</span>
            <SolveStatusLegend />
            <p className="ps-field-help">
              問題の右にある印を押すと切り替わります。記録はこのセットの中だけで数えます。
            </p>
          </div>

          <p className="set-detail-meta">
            {set.authorName} が作成 · 更新 {relativeDays(set.updatedAt)}
            <br />
            公開範囲: {set.status === "draft" ? "下書き" : VISIBILITY_LABEL[set.visibility]}
          </p>
        </aside>
      </div>
    </div>
  );
}
