/**
 * 読み込み中に出す骨組み。「読み込み中…」の1行だけを出す形をやめ、
 * 実物と同じ位置・同じ高さの灰色の箱を置く。読み込みが終わっても要素が動かない。
 *
 * client componentからもserver側の`loading.tsx`からも読むため、`"use client"`は付けない。
 * hookを使わず、状態も持たない。
 *
 * 中身は目では読めないので`aria-hidden`にし、代わりに読み上げ用の1行を添える。
 */

/** 灰色の箱1つ。幅はcallerが決め、高さは行の見た目に合わせる。 */
function Bar({ width, height = 14 }: { width: string; height?: number }) {
  return <span className="skeleton skeleton-bar" style={{ width, height: `${height}px` }} />;
}

/** 読み上げ用の1行。画面には出さない。 */
function LoadingLabel({ label }: { label: string }) {
  return (
    <p className="sr-only" role="status">
      {label}
    </p>
  );
}

/**
 * カード1枚。`SetCard`と同じ4段（タイトル／タグ／対象者・問題数／作成者・いいね）を持つ。
 * 高さを決めているCSS変数はカード側にあるので、同じclassを当てれば実物と同じ高さになる。
 */
export function SetCardSkeleton({ variant = "list" }: { variant?: "featured" | "list" }) {
  return (
    <div className={`set-card set-card-${variant} is-skeleton`} aria-hidden="true">
      <div className="set-card-head">
        <Bar width="72%" height={18} />
      </div>
      <div className="set-card-tags">
        <Bar width="64px" height={22} />
        <Bar width="88px" height={22} />
        <Bar width="52px" height={22} />
      </div>
      <dl className="set-card-facts">
        <div>
          <dt>
            <Bar width="40px" height={10} />
          </dt>
          <dd>
            <Bar width="56px" height={14} />
          </dd>
        </div>
        <div>
          <dt>
            <Bar width="40px" height={10} />
          </dt>
          <dd>
            <Bar width="36px" height={14} />
          </dd>
        </div>
      </dl>
      <div className="set-card-foot">
        <Bar width="96px" height={12} />
        <span className="set-card-likes">
          <Bar width="32px" height={12} />
        </span>
      </div>
    </div>
  );
}

export function SetGridSkeleton({
  count = 6,
  variant = "list",
}: {
  count?: number;
  variant?: "featured" | "list";
}) {
  return (
    <div className={`set-grid${variant === "featured" ? " is-featured" : ""}`}>
      {Array.from({ length: count }, (_, index) => (
        <SetCardSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
}

/** 見出しと説明文の2行。どの画面でも先頭に同じ形で出る。 */
function PageHeadSkeleton() {
  return (
    <div className="practice-page-head" aria-hidden="true">
      <div className="skeleton-stack">
        <Bar width="180px" height={24} />
        <Bar width="320px" height={14} />
      </div>
    </div>
  );
}

/** Discover。検索欄・タグ・対象者の絞り込みまで含めて位置を先に決める。 */
export function DiscoverSkeleton() {
  return (
    <div className="practice-page">
      <LoadingLabel label="問題セットを読み込んでいます" />
      <PageHeadSkeleton />

      <section className="filter-bar" aria-hidden="true">
        <div className="filter-search">
          <Bar width="100%" height={38} />
        </div>
        <div className="filter-tags">
          {Array.from({ length: 7 }, (_, index) => (
            <Bar key={index} width={`${56 + (index % 3) * 20}px`} height={26} />
          ))}
        </div>
        <div className="band-filter">
          <Bar width="88px" height={12} />
          <div className="band-filter-dots">
            {Array.from({ length: 8 }, (_, index) => (
              <Bar key={index} width="18px" height={18} />
            ))}
          </div>
        </div>
      </section>

      <section aria-hidden="true">
        <div className="ps-section-heading">
          <Bar width="160px" height={20} />
        </div>
        <SetGridSkeleton count={3} variant="featured" />
      </section>

      <section aria-hidden="true">
        <div className="ps-section-heading">
          <Bar width="200px" height={20} />
        </div>
        <SetGridSkeleton count={4} />
      </section>
    </div>
  );
}

/** マイページ。件数・タブ・カードの3段を先に置く。 */
export function LibrarySkeleton() {
  return (
    <div className="practice-page">
      <LoadingLabel label="ライブラリを読み込んでいます" />
      <PageHeadSkeleton />

      <dl className="library-stats" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="library-stat" key={index}>
            <dt>
              <Bar width="72px" height={12} />
            </dt>
            <dd>
              <Bar width="32px" height={20} />
            </dd>
          </div>
        ))}
      </dl>

      <div aria-hidden="true">
        <div className="library-tabs">
          {Array.from({ length: 4 }, (_, index) => (
            <Bar key={index} width="96px" height={32} />
          ))}
        </div>
        <div style={{ paddingTop: "var(--space-5)" }}>
          <SetGridSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}

/** セット詳細。本文と右の操作列の2段組を保つ。 */
export function SetDetailSkeleton() {
  return (
    <div className="practice-page">
      <LoadingLabel label="問題セットを読み込んでいます" />
      <div className="set-detail" aria-hidden="true">
        <div className="skeleton-stack">
          <div className="set-detail-tags">
            <Bar width="64px" height={24} />
            <Bar width="80px" height={24} />
          </div>
          <Bar width="60%" height={30} />
          <Bar width="90%" height={14} />

          <dl className="set-detail-facts">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <dt>
                  <Bar width="56px" height={10} />
                </dt>
                <dd>
                  <Bar width="72px" height={16} />
                </dd>
              </div>
            ))}
          </dl>

          <div className="ps-section-heading">
            <Bar width="120px" height={20} />
          </div>
          <div className="problem-list">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="problem-list-row is-skeleton" key={index}>
                <Bar width="16px" height={14} />
                <Bar width="52%" height={14} />
                <Bar width="64px" height={14} />
                <Bar width="48px" height={14} />
                <Bar width="24px" height={24} />
              </div>
            ))}
          </div>
        </div>

        <aside className="set-detail-side">
          <Bar width="100%" height={40} />
          <div className="reaction-row">
            <Bar width="72px" height={30} />
            <Bar width="88px" height={30} />
          </div>
          <Bar width="80px" height={30} />
        </aside>
      </div>
    </div>
  );
}

/** 設定・ログイン・作成画面のように、カード状のブロックが縦に並ぶ画面。 */
export function PracticeBlocksSkeleton({ blocks = 2, label }: { blocks?: number; label: string }) {
  return (
    <div className="practice-page">
      <LoadingLabel label={label} />
      <PageHeadSkeleton />
      {Array.from({ length: blocks }, (_, index) => (
        <section className="create-block skeleton-stack" key={index} aria-hidden="true">
          <Bar width="140px" height={18} />
          <Bar width="100%" height={38} />
          <Bar width="70%" height={14} />
        </section>
      ))}
    </div>
  );
}
