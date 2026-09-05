"use client";

import Link from "next/link";
import {
  SOLVE_STATUS_LABEL,
  VISIBILITY_LABEL,
  difficultyBand,
  nextSolveStatus,
  type ProblemSetSummary,
  type ProblemSetTag,
  type SolveStatus,
} from "@custom-contest/contracts";

/**
 * Difficultyの色ドット。色だけに依存させないため、数値と色名を必ず併記する。
 * Difficultyを持たない問題（EDPCや典型90）は「—」を出す。
 */
export function DifficultyDot({ difficulty }: { difficulty: number | null }) {
  const band = difficultyBand(difficulty);
  if (!band || difficulty === null) {
    return (
      <span className="ps-difficulty" title="この問題はDifficulty目安を取得できません">
        <span className="ps-diff-dot is-unknown" aria-hidden="true" />
        <span className="ps-diff-value">—</span>
      </span>
    );
  }
  return (
    <span className={`ps-difficulty ps-diff-${band.key}`}>
      <span className="ps-diff-dot" aria-hidden="true" />
      <span className="ps-diff-value">{difficulty}</span>
      <span className="ps-diff-name">{band.label}</span>
    </span>
  );
}

/** セットのDifficulty帯。色ドット＋レンジ＋色名を併記する。 */
export function DifficultyRangeChip({ range }: { range: { min: number; max: number } | null }) {
  if (!range) {
    return <span className="ps-difficulty">
      <span className="ps-diff-dot is-unknown" aria-hidden="true" />
      <span className="ps-diff-value">目安なし</span>
    </span>;
  }
  const low = difficultyBand(range.min);
  const high = difficultyBand(range.max);
  const name = low && high ? (low.key === high.key ? low.label : `${low.label}〜${high.label}`) : "";
  return (
    <span className={`ps-difficulty ps-diff-${high?.key ?? "gray"}`}>
      <span className="ps-diff-dot" aria-hidden="true" />
      <span className="ps-diff-value">
        {range.min}–{range.max}
      </span>
      {name && <span className="ps-diff-name">{name}</span>}
    </span>
  );
}

export function TagPill({
  tag,
  selected,
  onToggle,
}: {
  tag: ProblemSetTag | string;
  selected?: boolean;
  onToggle?: () => void;
}) {
  if (!onToggle) return <span className="tag-pill">{tag}</span>;
  return (
    <button
      type="button"
      className={`tag-pill is-button${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {selected && <span aria-hidden="true">✓ </span>}
      {tag}
    </button>
  );
}

/**
 * 全画面共通のカード（13章）。
 * ① タイトル（太字・左上）② カテゴリ／作者名（左下）③ いいね数（右）④ 公開状態pill
 */
export function SetCard({
  summary,
  variant = "list",
  showVisibility = false,
}: {
  summary: ProblemSetSummary;
  variant?: "featured" | "list";
  showVisibility?: boolean;
}) {
  const category = summary.tags[0] ?? "未分類";
  return (
    <Link className={`set-card set-card-${variant}`} href={`/sets/${summary.setId}`}>
      <div className="set-card-head">
        <h3 className="set-card-title">{summary.title}</h3>
        <span className="set-card-likes" aria-label={`いいね ${summary.likeCount}`}>
          <span aria-hidden="true">♡</span> {summary.likeCount}
        </span>
      </div>

      {variant === "featured" && (
        <dl className="set-card-facts">
          <div>
            <dt>Difficulty</dt>
            <dd>
              <DifficultyRangeChip range={summary.difficultyRange} />
            </dd>
          </div>
          <div>
            <dt>問題数</dt>
            <dd>{summary.problemCount}問</dd>
          </div>
          <div>
            <dt>想定時間</dt>
            <dd>約{summary.estimatedMinutes}分</dd>
          </div>
        </dl>
      )}

      <div className="set-card-foot">
        <span className="set-card-category">{category}</span>
        <span className="set-card-author">
          {summary.status === "draft" ? `${summary.problemCount}問構成中` : summary.authorName}
        </span>
        {showVisibility && (
          <span className={`visibility-pill is-${summary.status === "draft" ? "draft" : summary.visibility}`}>
            {summary.status === "draft" ? "下書き" : VISIBILITY_LABEL[summary.visibility]}
          </span>
        )}
      </div>
    </Link>
  );
}

/** 検索結果の1行（高密度・比較重視）。 */
export function SetRow({ summary }: { summary: ProblemSetSummary }) {
  return (
    <Link className="set-row" href={`/sets/${summary.setId}`}>
      <span className="set-row-title">{summary.title}</span>
      <span className="set-row-tags">
        {summary.tags.slice(0, 2).map((tag) => (
          <span className="tag-pill is-small" key={tag}>
            {tag}
          </span>
        ))}
      </span>
      <span className="set-row-difficulty">
        <DifficultyRangeChip range={summary.difficultyRange} />
      </span>
      <span className="set-row-count">{summary.problemCount}問</span>
      <span className="set-row-time">約{summary.estimatedMinutes}分</span>
      <span className="set-row-author">{summary.authorName}</span>
      <span className="set-row-likes">
        <span aria-hidden="true">♡</span> {summary.likeCount}
      </span>
    </Link>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="practice-empty">
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}

/**
 * 問題名そのものをAtCoderの問題ページへのリンクにする。
 * 一覧に「AtCoderで開く」ボタンを並べる代わりに、問題名をクリックする導線へ一本化した。
 */
export function ProblemTitleLink({
  problemId,
  contestId,
  title,
}: {
  problemId: string;
  contestId: string;
  title: string;
}) {
  return (
    <a
      className="problem-title-link"
      href={`https://atcoder.jp/contests/${contestId}/tasks/${problemId}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {title}
      <span className="problem-title-external" aria-hidden="true">
        ↗
      </span>
      <span className="sr-only">（AtCoderで開く）</span>
    </a>
  );
}

/**
 * 挑戦状態の3値トグル。押すたびに 未AC → 自力AC → 解説AC → 未AC と進む。
 * 色だけに依存させないため、常に状態名を文字でも出す。
 */
export function SolveStatusControl({
  status,
  problemTitle,
  onChange,
}: {
  status: SolveStatus;
  problemTitle: string;
  onChange: (next: SolveStatus) => void;
}) {
  return (
    <button
      className={`solve-status is-${status}`}
      type="button"
      onClick={() => onChange(nextSolveStatus(status))}
      aria-label={`${problemTitle}の挑戦状態: ${SOLVE_STATUS_LABEL[status]}。押すと次の状態へ変わります`}
    >
      <span className="solve-status-mark" aria-hidden="true">
        {status === "solved" ? "●" : status === "solved_with_editorial" ? "◐" : "○"}
      </span>
      {SOLVE_STATUS_LABEL[status]}
    </button>
  );
}

/** 押せない表示専用の挑戦状態。検索結果で「もう解いた問題か」を見るために使う。 */
export function SolveStatusMarker({ status }: { status: SolveStatus }) {
  if (status === "unsolved") return null;
  return (
    <span className={`solve-status is-readonly is-${status}`}>
      <span className="solve-status-mark" aria-hidden="true">
        {status === "solved" ? "●" : "◐"}
      </span>
      {SOLVE_STATUS_LABEL[status]}
    </span>
  );
}
