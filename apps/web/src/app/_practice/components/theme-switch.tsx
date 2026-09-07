"use client";

import { useSyncExternalStore } from "react";

/**
 * 精進skinの表示テーマ。設計13章と14章のダークを両方残し、利用者が選べるようにしている。
 * どちらか一方に決め切るまでは、実物を並べて比べられるほうが判断しやすい。
 */
export const PRACTICE_THEMES = [
  { key: "light", label: "ライト" },
  { key: "charcoal", label: "ダーク（近黒）" },
  { key: "soft", label: "ダーク（グレー）" },
] as const;

export type PracticeTheme = (typeof PRACTICE_THEMES)[number]["key"];

export const PRACTICE_THEME_STORAGE_KEY = "custom-contest:practice-theme";

/**
 * 初回描画より前に`<html>`へテーマを載せるスクリプト。
 * Reactのhydrationを待つと、選んだダークの上にライトが一瞬出てしまう。
 */
export const practiceThemeBootstrap = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  PRACTICE_THEME_STORAGE_KEY,
)});if(t==="charcoal"||t==="soft"){document.documentElement.dataset.practiceTheme=t;}}catch(e){}})();`;

/**
 * テーマの実体は`<html>`のdata属性で、Reactの外にある。
 * bootstrapスクリプトが先に書き込むため、Reactはそれを読む側に回る。
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
