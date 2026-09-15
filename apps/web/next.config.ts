import type { NextConfig } from "next";

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
   * Content-Security-Policyはまだ入れていない。`layout.tsx`のテーマ用inline scriptに
   * nonceまたはhashが要り、その作業はここだけでは終わらないため、別に扱う。
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
