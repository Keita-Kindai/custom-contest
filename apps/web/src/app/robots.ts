import type { MetadataRoute } from "next";

/**
 * 検索エンジンへ見せてよい範囲。
 *
 * 限定公開のセットは、`set_id`が推測しにくいことだけで守られている。URLが一度どこかへ出ると、
 * 検索結果に載って誰でも辿れるようになる。`/sets/`を丸ごと外すのは、serverがそのセットの
 * 公開範囲を知らないまま画面を返しているためで、公開・限定公開・非公開を出し分けられない。
 *
 * 公開セットは`/discover`から辿れる。セットの中身はclient側で読み込むので、
 * いまのところ`/sets/`を巡回させても検索エンジンが拾える内容はない。
 *
 * 個人の画面と API も外す。巡回されて得るものがなく、DBへの問い合わせだけが増える。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/sets/", "/library", "/settings", "/signin", "/battle/"],
    },
  };
}
