import { randomBytes } from "node:crypto";

/**
 * 問題セットのIDを作る。
 *
 * 限定公開の閲覧範囲は、このIDが推測しにくいことだけで守られている。
 * だからこの値はserverが作る。clientが決めた値を受け取ると、秘密の強さを
 * serverが保証できない（壊れたclientも、わざと弱いIDを送るclientも通ってしまう）。
 *
 * 形は既存のIDと同じ`ps_` + 英数36種10文字にしてある。桁を増やすと
 * `set_id varchar(13)`と`problemSetIdSchema`の両方が変わり、既に共有された
 * URLを作り直すことになる。36^10はおよそ2^51.7で、共有リンクの秘密としては足りる。
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const LENGTH = 10;

/**
 * 256は36で割り切れない（256 = 36 × 7 + 4）。byteをそのまま`% 36`すると
 * 先頭4文字だけが8回、残りが7回の割り当てになり、約14%出やすくなる。
 * 端数にあたるbyteは使わずに引き直す。
 */
const LIMIT = 256 - (256 % ALPHABET.length);

export function newSetId(): string {
  let out = "";
  while (out.length < LENGTH) {
    for (const byte of randomBytes(LENGTH * 2)) {
      if (byte >= LIMIT) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === LENGTH) break;
    }
  }
  return `ps_${out}`;
}
