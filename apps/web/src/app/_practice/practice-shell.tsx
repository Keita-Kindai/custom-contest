import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeSwitch } from "./components/theme-switch";
import "./practice.css";

type NavKey = "discover" | "create" | "library";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "discover", href: "/discover", label: "Discover" },
  { key: "create", href: "/sets/new", label: "作る" },
  { key: "library", href: "/library", label: "マイページ" },
];

/**
 * 精進側のshell。対戦側の`AppShell`とは別物で、1024px gateを持たない。
 * `data-skin="practice"`がtokens.cssのlight skinを有効にする。
 * ダークは`<html>`の`data-practice-theme`で上書きする（13章・14章）。
 * その属性を初回描画前に書くbootstrapスクリプトはroot layoutにある。
 */
export function PracticeShell({ current, children }: { current: NavKey; children: ReactNode }) {
  return (
    <div className="practice-shell" data-skin="practice">
      <header className="practice-header">
        <Link className="practice-brand" href="/discover">
          <span className="practice-brand-mark" aria-hidden="true" />
          Custom Contest
        </Link>
        <nav className="practice-nav" aria-label="メイン">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`practice-nav-link${item.key === current ? " is-current" : ""}`}
              aria-current={item.key === current ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeSwitch />
      </header>
      <main className="practice-main">{children}</main>
      <footer className="practice-footer">
        <p>
          サンプルデータで動作しています。作成した問題セットはこの端末のブラウザーにだけ保存され、
          ほかの端末からは開けません。
        </p>
      </footer>
    </div>
  );
}
