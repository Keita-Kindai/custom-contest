import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@custom-contest/contracts"],
  allowedDevOrigins: ['192.168.33.27', '*.trycloudflare.com'],

  /**
   * 対戦（AC Duel）を後回しにするあいだ、入口を精進側へ寄せる。
   *
   * 画面のファイルは`src/app/battle/`と`src/app/page.tsx`に残してあり、消していない。
   * 戻すときはこの`redirects()`を外すだけでよい。
   *
   * `permanent: false`（307）にしてある。恒久リダイレクトはブラウザーが覚えてしまい、
   * 対戦を戻したあとも古い転送が効き続けるため。
   * userscriptが叩く`/api/*`は転送しない。
   */
  async redirects() {
    return [
      { source: "/", destination: "/discover", permanent: false },
      { source: "/battle/:path*", destination: "/discover", permanent: false },
    ];
  },
};

export default nextConfig;
