import Link from "next/link";

import { AppShell } from "./_components/app-shell";
import { ProfileCard } from "./_components/profile-card";
import { RecentMatches } from "./_components/recent-matches";

export default function Home() {
  return (
    <AppShell>
      <section className="home-hero">
        <div className="hero-copy">
          <div>
            <p className="kicker">INVITE-ONLY / BO1</p>
            <h1>1問だけ。先に通した方が勝ち。</h1>
          </div>
          <p>
            Roomを友達に送り、同じAtCoderの過去問に挑みます。提出はAtCoder、勝敗と進行はこの画面で確認します。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/battle/new">Roomを作る <span aria-hidden="true">→</span></Link>
            <Link className="button button-quiet" href="/battle/join">IDで参加</Link>
          </div>
        </div>

        <aside className="duel-entry-grid hero-console" aria-label="デモの対戦条件">
          <div>
            <p className="kicker">SUNDAY DEMO</p>
            <h2 className="panel-title">すぐ遊べる範囲に固定</h2>
          </div>
          <dl className="spec-list">
            <div className="spec-row"><dt>MODE</dt><dd>BO1</dd><dd>2人</dd></div>
            <div className="spec-row"><dt>POOL</dt><dd>ABC C / D</dd><dd>400–1200</dd></div>
            <div className="spec-row"><dt>JUDGE</dt><dd>userscript確認</dd><dd>カジュアル</dd></div>
          </dl>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>この端末のプレイヤー</h2>
          <span className="section-note">本番ログイン導入前のデモ用</span>
        </div>
        <div className="duel-entry-grid">
          <ProfileCard />
          <div>
            <p className="kicker">CONNECTION</p>
            <h2 className="panel-title">AtCoderとの接続はRoom内で行います</h2>
            <p className="section-note">
              Room参加後に専用リンクを開き、Tampermonkey userscriptがログイン中のIDと判定取得を確認します。
            </p>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>この端末の直近3Match</h2>
          <span className="section-note">結果URLだけを端末内に保存</span>
        </div>
        <RecentMatches />
      </section>
    </AppShell>
  );
}
