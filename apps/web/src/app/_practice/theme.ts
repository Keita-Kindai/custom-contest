/**
 * 精進skinの表示テーマ。設計13章と14章のダークを両方残し、利用者が選べるようにしている。
 * どちらか一方に決め切るまでは、実物を並べて比べられるほうが判断しやすい。
 *
 * bootstrapスクリプトをroot layout（server component）から埋めるため、
 * ここは`"use client"`を付けない。client側の`components/theme-menu.tsx`もこの定義を読む。
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
 *
 * 置き場所はroot layoutの`<body>`直下に限る。画面側のcomponentに置くと、
 * client遷移でscript要素が作り直され、実行されないままReactが警告を出す。
 */
export const practiceThemeBootstrap = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  PRACTICE_THEME_STORAGE_KEY,
)});if(t==="charcoal"||t==="soft"){document.documentElement.dataset.practiceTheme=t;}}catch(e){}})();`;
