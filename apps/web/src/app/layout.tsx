import type { Metadata } from "next";
import type { ReactNode } from "react";

import { practiceThemeBootstrap } from "./_practice/theme";
import "../../tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Custom Contest",
  description: "AtCoderの過去問から問題セットを作り、共有して解き進めます。",
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
