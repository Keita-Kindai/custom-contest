"use client";

import { useSyncExternalStore } from "react";

import { PRACTICE_THEMES, PRACTICE_THEME_STORAGE_KEY, type PracticeTheme } from "../theme";

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

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as PracticeTheme);

  return (
    <div className="theme-switch" role="group" aria-label="表示テーマ">
      {PRACTICE_THEMES.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`theme-switch-option${theme === option.key ? " is-current" : ""}`}
          aria-pressed={theme === option.key}
          onClick={() => applyTheme(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
