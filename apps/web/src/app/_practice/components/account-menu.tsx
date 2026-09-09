"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOutAction } from "../actions";
import { HeaderMenu } from "./header-menu";

/** アカウント名の頭文字。空白しかない名前でも枠が欠けないよう、必ず1文字返す。 */
function initialOf(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toUpperCase() : "?";
}

/**
 * ヘッダー右端のアカウントメニュー。プロフィール設定とログアウトを畳んでいる。
 *
 * ログアウトは押した時点では実行せず、確認モーダルを挟む。誤って押すと
 * この端末の表示が入れ替わるうえ、GitHubへ入り直す手間が要るため。
 */
export function AccountMenu({ name }: { name: string }) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  /*
   * Escapeはdocumentで受ける。モーダルの中にfocusが入っていないと、
   * カード自身のonKeyDownまでキーが届かない。開いた直後にキャンセルへfocusを移し、
   * Enterがそのまま確定へ流れないようにもしている。
   */
  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirming(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  return (
    <>
      <HeaderMenu
        lead={`${name} のアカウント`}
        label={
          <>
            <span className="account-avatar" aria-hidden="true">
              {initialOf(name)}
            </span>
            <span className="header-menu-label account-name">{name}</span>
          </>
        }
      >
        {(close) => (
          <>
            <Link className="header-menu-item" role="menuitem" href="/settings" onClick={close}>
              プロフィール設定
            </Link>
            <button
              type="button"
              role="menuitem"
              className="header-menu-item is-danger"
              onClick={() => {
                close();
                setConfirming(true);
              }}
            >
              ログアウト
            </button>
          </>
        )}
      </HeaderMenu>

      {confirming && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirming(false);
          }}
        >
          <div
            className="modal-card is-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-modal-title"
          >
            <h2 className="modal-title" id="signout-modal-title">
              ログアウトしますか？
            </h2>
            <p className="modal-lead">
              この端末からログアウトします。作成したセットはアカウントに保存されているため、
              再ログインすればまた使えます。
            </p>

            <div className="modal-actions">
              <button
                className="practice-button is-quiet"
                type="button"
                ref={cancelRef}
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </button>
              <form action={signOutAction}>
                <button className="practice-button is-danger-solid" type="submit">
                  ログアウトする
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
