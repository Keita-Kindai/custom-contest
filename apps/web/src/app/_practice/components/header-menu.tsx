"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * ヘッダー右側のメニューバー。表示テーマとアカウントで同じ形と同じ閉じ方を使う。
 *
 * 開閉はcomponent内のstateで持つ。閉じる条件は3つで、どれも同じ挙動にしてある。
 * 外側を押す・Escapeを押す・中の項目を押す。項目側はrenderの引数で受け取った`close`を呼ぶ。
 */
export function HeaderMenu({
  label,
  lead,
  align = "end",
  children,
}: {
  /** ボタンの中身。テーマの色ドットやアカウントの頭文字を含む。 */
  label: ReactNode;
  /** スクリーンリーダー向けのボタン名。見た目のラベルが記号だけでも意味が伝わるようにする。 */
  lead: string;
  align?: "start" | "end";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        type="button"
        className={`header-menu-trigger${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={lead}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <span className="header-menu-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className={`header-menu-popup is-${align}`} id={menuId} role="menu" aria-label={lead}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
