import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <section className="mobile-gate" aria-labelledby="mobile-gate-title">
        <p className="mono-label">PC / TABLET REQUIRED</p>
        <h1 id="mobile-gate-title">この対戦はPCで開いてください</h1>
        <p>
          AtCoderの問題画面と並べて使うため、横幅1024px以上のPC・タブレットに対応しています。招待URLはこの端末からPCへ共有できます。
        </p>
      </section>

      <div className="desktop-app">
        <header className="site-header">
          <Link className="brand" href="/" aria-label="AC Duel トップへ">
            <span className="brand-mark" aria-hidden="true" />
            <span>AC Duel</span>
          </Link>
          <div className="header-profile" aria-label="デモ環境の状態">
            <span className="status-dot" aria-hidden="true" />
            <span>DEMO / INVITE ONLY</span>
          </div>
        </header>
        <main className="app-main">
          <div className="app-shell">{children}</div>
        </main>
      </div>
    </>
  );
}
