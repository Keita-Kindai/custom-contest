import { problemSetIdSchema } from "@custom-contest/contracts";
import { describe, expect, it } from "vitest";

import { newSetId } from "./set-id";

/**
 * 限定公開の閲覧範囲は、このIDが推測しにくいことだけで守られている。
 * 形が既存のIDと同じであること、そして分布に偏りがないことを確かめる。
 */
describe("newSetId", () => {
  it("matches the id format the rest of the app already accepts", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(problemSetIdSchema.safeParse(newSetId()).success).toBe(true);
    }
  });

  it("does not repeat itself", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newSetId()));
    expect(ids.size).toBe(2000);
  });

  it("spreads the alphabet evenly, rather than favouring its first letters", () => {
    /*
     * 256は36で割り切れない（256 = 36 × 7 + 4）。byteをそのまま`% 36`すると
     * `a`から`d`だけが約14%多く出る。端数を捨てて引き直しているので、
     * 先頭4文字と残りの出現率に差が出ないことを確かめる。
     */
    const counts = new Map<string, number>();
    const samples = 20_000;
    for (let i = 0; i < samples; i += 1) {
      for (const character of newSetId().slice(3)) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }

    expect(counts.size).toBe(36);

    const biased = ["a", "b", "c", "d"];
    const share = (characters: string[]) =>
      characters.reduce((total, character) => total + (counts.get(character) ?? 0), 0) /
      (samples * 10) /
      characters.length;

    const rest = [...counts.keys()].filter((character) => !biased.includes(character));
    const ratio = share(biased) / share(rest);
    // 剰余をそのまま使っていれば8/7 ≒ 1.14になる。引き直していれば1に寄る。
    expect(ratio).toBeGreaterThan(0.94);
    expect(ratio).toBeLessThan(1.06);
  });
});
