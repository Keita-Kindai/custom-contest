import type { NextConfig } from "next";

/**
 * Content-Security-Policy。
 *
 * `script-src`に`'unsafe-inline'`が入っている。Next.jsはhydrationのためのデータを
 * inline scriptで配るので、これを外すには1 requestごとにnonceを作ってNextへ渡す
 * middlewareが要る。middlewareはVercelでrequestごとのFunction実行になり、
 * 無料枠の天井（ADR-0010）に直接効く。そこまでの費用を払う段ではないと判断した。
 *
 * その状態でもこのpolicyが止めるものはある。
 *
 * - `script-src 'self'`：他所のドメインからscriptを読み込めない。
 *   XSSが「外部のscriptを差し込む」形を取れなくなる。
 * - `connect-src 'self'`：どこへも送信できない。inline scriptが動いたとしても、
 *   そこから外部へデータを持ち出す経路が閉じる。
 * - `object-src 'none'`、`base-uri 'self'`、`form-action 'self'`：
 *   `<object>`、`<base>`の差し替え、formの送信先の乗っ取りを塞ぐ。
 *
 * 止まらないのは、inline scriptそのものの実行である。そこはnonceを入れるまで開いている。
 *
 * 開発では付けない。`next dev`のHMRがwebsocketで繋ぐため、`connect-src`で切ると
 * 開発だけが壊れる。
 */
const CONTENT_SECURITY_POLICY =
  process.env.NODE_ENV === "production"
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join("; ")
    : null;

const nextConfig: NextConfig = {
  transpilePackages: ["@custom-contest/contracts"],
  allowedDevOrigins: ['192.168.33.27', '*.trycloudflare.com'],

  /**
   * 対戦（AC Duel）を後回しにするあいだ、入口を精進側へ寄せる。
   *
   * 画面のファイルは`src/app/battle/`に残し、旧トップは
   * `src/app/_components/duel-home.tsx`へ保存してある。
   * 精進側のトップLPは公開するので、`/`は転送しない。
   *
   * `permanent: false`（307）にしてある。恒久リダイレクトはブラウザーが覚えてしまい、
   * 対戦を戻したあとも古い転送が効き続けるため。
   * userscriptが叩く`/api/*`は転送しない。
   */
  /**
   * 全応答へ付ける最低限の防御。
   *
   * `Referrer-Policy`は、限定公開セットのURLが外部サイトのアクセスログへ流れるのを防ぐ。
   * 個々のリンクには`rel="noreferrer"`を付けてあるが、付け忘れた1本で同じ穴が開くため、
   * 既定をこちらで決めておく。
   *
   * Content-Security-Policyは本番だけに付ける。中身と、いま止まらないものは
   * `CONTENT_SECURITY_POLICY`の説明にある。
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(CONTENT_SECURITY_POLICY
            ? [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }]
            : []),
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 他サイトのiframeへ入れさせない。clickjackingの対策。
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/battle/:path*", destination: "/discover", permanent: false },
    ];
  },
};

export default nextConfig;
