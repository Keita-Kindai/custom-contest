import type { Metadata } from "next";
import type { ReactNode } from "react";

import { practiceThemeBootstrap } from "./_practice/theme";
import "../../tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AC Duel — 友達とAtCoder BO1",
  description: "AtCoderの過去問で、友達と1問先取のカジュアル対戦。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        {/*
         * 精進skinのダークを初回描画前に当てる。root layoutはclient遷移で作り直されないので、
         * ここに置いたscriptだけが実際に実行される。画面側のcomponentへ置くと実行されない。
         */}
        <script dangerouslySetInnerHTML={{ __html: practiceThemeBootstrap }} />
        {children}
      </body>
    </html>
  );
}
