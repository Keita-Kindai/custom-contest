import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH } from "@custom-contest/contracts";

/** ランダム値の供給元。testでは決定的な実装を渡す。 */
export type RandomSource = {
  /** 指定byte数の乱数を返す。 */
  bytes(length: number): Uint8Array;
};

export const cryptoRandomSource: RandomSource = {
  bytes(length) {
    const buffer = new Uint8Array(length);
    globalThis.crypto.getRandomValues(buffer);
    return buffer;
  },
};

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

export function randomHex(random: RandomSource, hexLength: number): string {
  return toHex(random.bytes(Math.ceil(hexLength / 2))).slice(0, hexLength);
}

export function newRoomId(random: RandomSource): string {
  const bytes = random.bytes(ROOM_ID_LENGTH);
  let out = "";
  for (const byte of bytes) out += ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length];
  return out;
}

export function newParticipantKey(random: RandomSource): string {
  return `pk_${randomHex(random, 32)}`;
}

export function newLinkKey(random: RandomSource): string {
  return `lk_${randomHex(random, 24)}`;
}

export function newScriptToken(random: RandomSource): string {
  return `st_${randomHex(random, 40)}`;
}

export function newMatchId(random: RandomSource): string {
  return `m_${randomHex(random, 26)}`;
}

export function newSeed(random: RandomSource): string {
  return randomHex(random, 16);
}

/**
 * seedから決定的な乱数列を作る。同じseedからは同じ問題が選ばれる。
 * mulberry32を使い、外部依存を持たない。
 */
export function seededPicker(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
