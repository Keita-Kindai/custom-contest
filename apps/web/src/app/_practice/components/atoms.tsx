"use client";

import Link from "next/link";
import {
  SOLVE_STATUS_LABEL,
  VISIBILITY_LABEL,
  difficultyBand,
  nextSolveStatus,
  targetBandRange,
  type BandKey,
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
    <span className={`ps-difficulty ps-diff-${band.key}`} aria-label={`Difficulty ${difficulty}（${band.label}）`}>
      <span className="ps-diff-dot" aria-hidden="true" />
      <span className="ps-diff-value">{difficulty}</span>
    </span>
  );
}

/** 想定者（対象のrating色）。1段だけならその段、複数なら最小段〜最大段。 */
export function TargetBandChip({ bands }: { bands: readonly BandKey[] }) {
  const range = targetBandRange(bands);
  if (!range) return <span className="ps-target is-unset">未設定</span>;
  const single = range.min.key === range.max.key;
  return (
    <span className="ps-target">
      <span className={`ps-band-chip ps-diff-${range.min.key}`}>{range.min.label}</span>
      {!single && (
        <>
          <span className="ps-target-tilde" aria-hidden="true">〜</span>
          <span className={`ps-band-chip ps-diff-${range.max.key}`}>{range.max.label}</span>
        </>
      )}
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
    <span
      className={`ps-difficulty is-range ps-diff-${high?.key ?? "gray"}`}
      aria-label={`Difficulty ${range.min}から${range.max}${name ? `（${name}）` : ""}`}
    >
      <span className="ps-diff-dot" aria-hidden="true" />
      <span className="ps-diff-value">
        {range.min}–{range.max}
      </span>
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
            <dt>想定者</dt>
            <dd>
              <TargetBandChip bands={summary.targetBands} />
            </dd>
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

const SOLVE_STATUS_MARK: Record<SolveStatus, string> = {
  unsolved: "○",
  solved: "●",
  solved_with_editorial: "◐",
};

/**
 * 挑戦状態の3値トグル。押すたびに 未着手 → 自力 → 解説 → 未着手 と進む。
 *
 * 幅は3状態で同じにしてあるので、押しても隣のDifficultyがずれない。
 * 色だけで区別させないため、○ ● ◐ の形も併せて出す（ADR-0007）。
 */
export function SolveStatusControl({
  status,
  problemTitle,
  compact = false,
  onChange,
}: {
  status: SolveStatus;
  problemTitle: string;
  /** 一覧の行に置くとき。文字を出さず印だけにする。 */
  compact?: boolean;
  onChange: (next: SolveStatus) => void;
}) {
  return (
    <button
      className={`solve-status is-${status}${compact ? " is-compact" : ""}`}
      type="button"
      onClick={() => onChange(nextSolveStatus(status))}
      aria-label={`${problemTitle}の挑戦状態: ${SOLVE_STATUS_LABEL[status]}。押すと次の状態へ変わります`}
      title={SOLVE_STATUS_LABEL[status]}
    >
      <span className="solve-status-mark" aria-hidden="true">
        {SOLVE_STATUS_MARK[status]}
      </span>
      {!compact && <span className="solve-status-text">{SOLVE_STATUS_LABEL[status]}</span>}
    </button>
  );
}

/** 挑戦状態の意味を1か所で説明する。行から文字を外したぶん、ここが正解表になる。 */
export function SolveStatusLegend() {
  return (
    <dl className="solve-legend">
      {(["solved", "solved_with_editorial", "unsolved"] as const).map((status) => (
        <div key={status}>
          <dt>
            <span className={`solve-status is-readonly is-${status}`}>
              <span className="solve-status-mark" aria-hidden="true">
                {SOLVE_STATUS_MARK[status]}
              </span>
            </span>
          </dt>
          <dd>{SOLVE_STATUS_LABEL[status]}</dd>
        </div>
      ))}
    </dl>
  );
}
