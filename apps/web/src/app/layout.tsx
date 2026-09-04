import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../../tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AC Duel — 友達とAtCoder BO1",
  description: "AtCoderの過去問で、友達と1問先取のカジュアル対戦。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
