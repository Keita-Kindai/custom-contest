"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeProblemSets } from "./data/repository";

/**
 * repositoryの非同期読み出しをReactへつなぐ。
 * 保存内容が変わると再取得する。DBへ移行しても呼び出し側は変わらない。
 */
export function usePracticeData<T>(load: () => Promise<T>, deps: unknown[]): {
  data: T | null;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    // 再取得中もloadingへ戻さず、前の結果を出したままにする。
    // 条件を変えるたびに画面が空になるのを避けるためで、effect内の同期setStateも起こさない。
    load()
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // loadは呼び出し側でdepsを明示する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  useEffect(() => subscribeProblemSets(reload), [reload]);

  return { data, loading, reload };
}
