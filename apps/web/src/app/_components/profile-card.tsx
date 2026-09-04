"use client";

import { useRef, useState, useSyncExternalStore } from "react";

import { PROFILE_KEY } from "./client-storage";

export function ProfileCard() {
  const [message, setMessage] = useState("Roomへ入る前なら変更できます。");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedId = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    () => window.localStorage.getItem(PROFILE_KEY) ?? "Litms",
    () => "Litms",
  );

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = inputRef.current?.value.trim() ?? "";
    if (!normalized) {
      setMessage("AtCoder IDが空です。AtCoderで使っているユーザー名を入力してください。");
      return;
    }

    window.localStorage.setItem(PROFILE_KEY, normalized);
    window.dispatchEvent(new StorageEvent("storage", { key: PROFILE_KEY, newValue: normalized }));
    setMessage("この端末に保存しました。Room参加後は変更できません。");
  }

  return (
    <form className="profile-form" onSubmit={saveProfile}>
      <div>
        <p className="kicker">PLAYER</p>
        <h2 className="panel-title">開発用プロフィール</h2>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="atcoder-id">
          AtCoder ID
        </label>
        <input
          key={savedId}
          ref={inputRef}
          className="input"
          id="atcoder-id"
          defaultValue={savedId}
          autoComplete="username"
          spellCheck={false}
        />
        <p className="field-help" aria-live="polite">
          {message}
        </p>
      </div>
      <div className="action-row">
        <button className="button button-quiet" type="submit">
          IDを保存
        </button>
        <span className="helper">現在: {savedId}</span>
      </div>
    </form>
  );
}
