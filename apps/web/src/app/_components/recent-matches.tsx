"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import {
  getRecentMatchPaths,
  recentMatchPathsSnapshot,
  subscribeRecentMatchPaths,
} from "./client-storage";

export function RecentMatches() {
  const serialized = useSyncExternalStore(subscribeRecentMatchPaths, recentMatchPathsSnapshot, () => "[]");
  const paths = useMemo(() => getRecentMatchPaths(serialized), [serialized]);

  if (paths.length === 0) {
    return (
      <div className="empty-state">
        <strong>まだ対戦結果がありません。</strong>
        <span>最初のMatchを終えると、ここから限定公開の結果画面を開けます。</span>
        <Link className="button button-quiet" href="/battle/new">最初のRoomを作る</Link>
      </div>
    );
  }

  return (
    <ol className="recent-match-list">
      {paths.map((path, index) => (
        <li key={path}>
          <div><span className="kicker">{index === 0 ? "LATEST" : `MATCH ${index + 1}`}</span><strong>{path.slice(-10)}</strong></div>
          <Link className="button button-quiet" href={path}>結果を見る</Link>
        </li>
      ))}
    </ol>
  );
}
