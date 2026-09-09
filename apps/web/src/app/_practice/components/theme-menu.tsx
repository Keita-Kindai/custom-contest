"use client";

import { useSyncExternalStore } from "react";

import { PRACTICE_THEMES, PRACTICE_THEME_STORAGE_KEY, type PracticeTheme } from "../theme";
import { HeaderMenu } from "./header-menu";

/**
 * テーマの実体は`<html>`のdata属性で、Reactの外にある。
 * root layoutのbootstrapスクリプトが先に書き込むため、Reactはそれを読む側に回る。
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentTheme(): PracticeTheme {
  const applied = document.documentElement.dataset.practiceTheme;
  return applied === "charcoal" || applied === "soft" ? applied : "light";
}

/** `<html>`のdata属性と保存内容を書き換え、購読者へ知らせる。 */
function applyTheme(next: PracticeTheme): void {
  if (next === "light") {
    delete document.documentElement.dataset.practiceTheme;
  } else {
    document.documentElement.dataset.practiceTheme = next;
  }
  try {
    window.localStorage.setItem(PRACTICE_THEME_STORAGE_KEY, next);
  } catch {
    // 保存できなくてもこの画面のあいだは切り替えを続ける。
  }
  for (const listener of listeners) listener();
}

/**
 * 表示テーマの選択。3案を横に並べる帯をやめ、メニューバーに畳んだ。
 * ヘッダーの右側はボタン2つになり、案を増やしても幅が伸びない。
 */
export function ThemeMenu() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as PracticeTheme);

  return (
    <HeaderMenu
      lead="表示テーマ"
      label={
        <>
          <span className={`theme-swatch is-${theme}`} aria-hidden="true" />
          <span className="header-menu-label">Color</span>
        </>
      }
    >
      {(close) =>
        PRACTICE_THEMES.map((option) => (
          <button
            key={option.key}
            type="button"
            role="menuitemradio"
            aria-checked={theme === option.key}
            className={`header-menu-item${theme === option.key ? " is-current" : ""}`}
            onClick={() => {
              applyTheme(option.key);
              close();
            }}
          >
            <span className={`theme-swatch is-${option.key}`} aria-hidden="true" />
            {option.label}
          </button>
        ))
      }
    </HeaderMenu>
  );
}
