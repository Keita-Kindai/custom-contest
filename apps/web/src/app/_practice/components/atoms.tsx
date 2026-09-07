"use client";

import Link from "next/link";
import {
  SOLVE_STATUS_LABEL,
  VISIBILITY_LABEL,
  difficultyBand,
  nextSolveStatus,
  orderedTargetBands,
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

/**
 * 想定者（対象のrating色）。選んだ段の色ドットを、その数だけ表示順に並べる。
 * 最小〜最大のレンジにはしない。飛ばした段を含んでいるように見えてしまうため。
 */
export function TargetBandDots({ bands }: { bands: readonly BandKey[] }) {
  const ordered = orderedTargetBands(bands);
  if (ordered.length === 0) return <span className="ps-target is-unset">未設定</span>;
  return (
    <span className="ps-target" aria-label={`想定者 ${ordered.map((band) => band.label).join("・")}`}>
      {ordered.map((band) => (
        <span key={band.key} className={`ps-target-dot ps-diff-${band.key}`} title={band.label} />
      ))}
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
 * Discoverとマイページ共通のカード（15a）。
 * ① タイトル＋いいね数 ② タグを省略せず全件 ③ 対象者の色ドットと問題数 ④ 作成者名。
 *
 * Difficultyの数値レンジは載せない。カード幅に収まらないうえ、対象者の色と役割が重なるため、
 * 「誰向けか」は対象者のドット列だけで表す。
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
  return (
    <Link className={`set-card set-card-${variant}`} href={`/sets/${summary.setId}`}>
      <div className="set-card-head">
        <h3 className="set-card-title">{summary.title}</h3>
        <span className="set-card-likes" aria-label={`いいね ${summary.likeCount}`}>
          <span aria-hidden="true">♡</span> {summary.likeCount}
        </span>
      </div>

      {summary.tags.length > 0 && (
        <div className="set-card-tags">
          {summary.tags.map((tag) => (
            <span className="tag-pill is-small" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <dl className="set-card-facts">
        <div>
          <dt>対象者</dt>
          <dd>
            <TargetBandDots bands={summary.targetBands} />
          </dd>
        </div>
        <div>
          <dt>問題数</dt>
          <dd>{summary.problemCount}問</dd>
        </div>
      </dl>

      <div className="set-card-foot">
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
