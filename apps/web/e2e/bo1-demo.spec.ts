import { expect, test, type Page } from "@playwright/test";

async function connectScript(page: Page, roomId: string, participantKey: string, atcoderId: string) {
  const issued = await page.request.post(`/api/rooms/${roomId}/link-key`, { data: { participantKey } });
  expect(issued.ok()).toBeTruthy();
  const { linkKey, handoffUrl } = (await issued.json()) as { linkKey: string; handoffUrl: string };
  expect(new URL(handoffUrl).origin).toBe("https://atcoder.jp");
  expect(new URL(handoffUrl).pathname).toBe("/");
  const linked = await page.request.post("/api/userscript/link", {
    data: { linkKey, loginAtcoderId: atcoderId, scriptVersion: "e2e" },
  });
  expect(linked.ok()).toBeTruthy();
  const { scriptToken } = (await linked.json()) as { scriptToken: string };
  const heartbeat = await page.request.post("/api/userscript/heartbeat", {
    data: {
      scriptToken,
      health: { loggedIn: true, loginAtcoderId: atcoderId, judgeReachable: true, checkedAt: new Date().toISOString() },
    },
  });
  expect(heartbeat.ok()).toBeTruthy();
}

test("host and invitee finish, reopen, and agree to rematch one server-authoritative BO1", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const inviteeContext = await browser.newContext();
  const host = await hostContext.newPage();
  const invitee = await inviteeContext.newPage();

  await host.goto("/");
  await host.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-04-home.png", fullPage: true });
  await host.goto("/battle/new");
  await host.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-03-room-settings.png", fullPage: true });
  await host.getByRole("button", { name: "Roomを作成" }).click();
  await expect(host).toHaveURL(/\/battle\/r\/([A-HJ-NP-Z2-9]{6})$/);
  const roomId = host.url().match(/\/battle\/r\/([A-HJ-NP-Z2-9]{6})$/)?.[1];
  if (!roomId) throw new Error("room ID missing");
  const hostKey = await host.evaluate((id) => localStorage.getItem(`ac-duel:participant:${id}`), roomId);
  if (!hostKey) throw new Error("host key missing");

  await invitee.goto("/");
  await invitee.evaluate(() => localStorage.setItem("ac-duel:atcoder-id", "friend_1400"));
  await invitee.goto(`/battle/r/${roomId}`);
  await expect(invitee.getByText("friend_1400", { exact: true }).first()).toBeVisible();
  const inviteeKey = await invitee.evaluate((id) => localStorage.getItem(`ac-duel:participant:${id}`), roomId);
  if (!inviteeKey) throw new Error("invitee key missing");

  await connectScript(host, roomId, hostKey, "Litms");
  await connectScript(invitee, roomId, inviteeKey, "friend_1400");
  await expect(host.getByText("AtCoder接続を確認済み").first()).toBeVisible();
  await expect(invitee.getByText("AtCoder接続を確認済み").first()).toBeVisible();
  await host.getByRole("button", { name: "READYにする" }).click();
  await invitee.getByRole("button", { name: "READYにする" }).click();
  await expect(host.getByRole("button", { name: "開始する" })).toBeEnabled();
  await host.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-03-waiting-ready.png", fullPage: true });
  await host.getByRole("button", { name: "開始する" }).click();
  await expect(host.getByText("MATCH STARTS IN")).toBeVisible();
  await host.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-04-countdown.png", fullPage: true });
  await expect(host.locator(".countdown-number")).toHaveText("START", { timeout: 5_000 });
  await host.waitForTimeout(400);
  await expect(host.locator(".countdown-number")).toHaveText("START");
  await expect(host.getByRole("link", { name: /AtCoderで問題を開く/ })).toBeVisible({ timeout: 8_000 });
  await host.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-03-live-match.png", fullPage: true });

  await invitee.getByText("デモ操作", { exact: true }).click();
  await invitee.getByRole("button", { name: "AC", exact: true }).click();
  await expect(invitee.getByText("WIN", { exact: true })).toBeVisible();
  await expect(host.getByText("LOSE", { exact: true })).toBeVisible();
  await expect(invitee.locator(".result-overlay-card.result-win")).toBeVisible();
  await expect(host.locator(".result-overlay-card.result-lose")).toBeVisible();
  await invitee.waitForTimeout(500);
  await invitee.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-03-result-win.png", fullPage: true });
  await host.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-04-result-lose.png", fullPage: true });

  await invitee.getByRole("link", { name: "結果を見る" }).click();
  await expect(invitee).toHaveURL(/\/battle\/m\/[A-Za-z0-9_-]+$/);
  await expect(invitee.getByRole("heading", { name: "1 — 0" })).toBeVisible();
  await expect(invitee.getByText("カジュアル対戦", { exact: false })).toBeVisible();
  await invitee.reload();
  await expect(invitee.getByRole("heading", { name: "1 — 0" })).toBeVisible();
  await invitee.getByRole("link", { name: "Roomへ戻る" }).click();
  await expect(invitee.getByText("WIN", { exact: true })).toBeVisible();

  await invitee.getByRole("button", { name: "再戦を申し込む" }).click();
  await expect(host.getByRole("button", { name: "再戦を承認" })).toBeVisible();
  await host.getByRole("button", { name: "再戦を承認" }).click();
  await expect(host.getByRole("heading", { name: "両者の準備を確認" })).toBeVisible();
  await expect(invitee.getByRole("heading", { name: "両者の準備を確認" })).toBeVisible();
  await invitee.getByRole("link", { name: "AC Duel" }).click();
  await expect(invitee.getByRole("heading", { name: "この端末の直近3Match" })).toBeVisible();
  await expect(invitee.getByRole("link", { name: "結果を見る" })).toHaveAttribute("href", /\/battle\/m\/m_/);
  await invitee.screenshot({ path: "docs/ai/handoffs/screenshots/2026-09-04-recent-matches.png", fullPage: true });

  await hostContext.close();
  await inviteeContext.close();
});
