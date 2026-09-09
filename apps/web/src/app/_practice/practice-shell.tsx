/**
 * ヘッダーおよびフッターを管理するtsxファイル。
 * 今回ここでブラウザ側で環rejctするものはないのでサーバーサイドで管理するtsxファイル
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { auth } from "@/auth";

import { AccountMenu } from "./components/account-menu";
import { ThemeMenu } from "./components/theme-menu";
import "./practice.css";

// 現状、ページにあるセクションは以下の通り
// discover: 主に問題セットを探すときに扱うページ。人気のやつとか、検索で見つける感じの場所
// create  : 問題セットを自分で作成するページ
// library : 自分が作成した問題リストや、いいねした問題リスト、保存した問題リストを閲覧することができる場所
type NavKey = "discover" | "create" | "library";

//  上記のページのリンクとラベルを作成したもの
//  あとで中でmapを使ってnavigatorを作成する
const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "discover", href: "/discover", label: "Discover" },
  { key: "create", href: "/sets/new", label: "作る" },
  { key: "library", href: "/library", label: "マイページ" },
];

/**
 * shellの骨組み。ヘッダー右端だけを差し替えられるようにしてある。
 *
 * 本物のshellはsessionを待つが、`loading.tsx`のスケルトンは待てない。
 * ここを共通にしておくと、読み込み中と読み込み後で見出しやnavの位置がずれない。
 */
function PracticeShellFrame({
  current,
  headerEnd, // ヘッダーエンドはログイン、もしくはログアウトを表示するコンポーネントが入っている
  children,
}: {
  current?: NavKey;
  headerEnd: ReactNode;
  children: ReactNode;
}) {
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
        <div className="practice-header-end">{headerEnd}</div>
      </header>
      <main className="practice-main">{children}</main>
      {/* <footer className="practice-footer">
        <p>
          作成した問題セットはアカウントに保存されます。ログインすれば別の端末からも開けます。
        </p>
      </footer> */}
    </div>
  );
}

/**
 * 精進側のshell。対戦側の`AppShell`とは別物で、1024px gateを持たない。
 * `data-skin="practice"`がtokens.cssのlight skinを有効にする。
 * ダークは`<html>`の`data-practice-theme`で上書きする（13章・14章）。
 * その属性を初回描画前に書くbootstrapスクリプトはroot layoutにある。
 *
 * sessionを読むため、このshellを使う画面はすべてrequestごとの描画になる。
 * ログイン状態は人によって違うので、静的に配れない。
 */
export async function PracticeShell({
  current,
  children,
}: {
  /** どのnavを現在地として示すか。どれでもない画面（設定、ログイン）では省く。 */
  current?: NavKey;
  children: ReactNode;
}) {

  // 現在のセッション情報を受け取って、ログインしているかどうかを検証する
  const session = await auth();

  return (
    <PracticeShellFrame
      current={current}
      headerEnd={
        <>
          <ThemeMenu />
          {session?.user ? (
            <AccountMenu name={session.user.name ?? "アカウント"} />
          ) : (
            <Link className="practice-account-button" href="/signin">
              ログイン
            </Link>
          )}
        </>
      }
    >
      {children}
    </PracticeShellFrame>
  );
}

/**
 * `loading.tsx`が出すshell。sessionを待たないので、アカウント欄は形だけ置く。
 *
 * テーマのメニューはここでも本物を出す。`<html>`のdata属性から現在値を読むだけで、
 * sessionにもfetchにも依存しないため、読み込み中でも押せて構わない。
 */
export function PracticeShellSkeleton({
  current,
  children,
}: {
  current?: NavKey;
  children: ReactNode;
}) {
  return (
    <PracticeShellFrame
      current={current}
      headerEnd={
        <>
          <ThemeMenu />
          <span className="skeleton header-menu-placeholder" aria-hidden="true" />
        </>
      }
    >
      {children}
    </PracticeShellFrame>
  );
}
