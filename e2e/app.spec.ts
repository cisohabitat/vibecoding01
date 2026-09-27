import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Console errors that are expected outside Vercel or without NVD access
const IGNORED_ERRORS = /_vercel|Failed to load resource/;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED_ERRORS.test(m.text())) errors.push(m.text());
  });
  return errors;
}

const card = (page: Page, text: string) => page.locator("article", { hasText: text }).first();

test.beforeEach(async ({ context }) => {
  // Article links point at example.com; keep the tests offline
  await context.route("https://example.com/**", (r) =>
    r.fulfill({ body: "article", contentType: "text/html" })
  );
});

test("renders ranked articles without hydration errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Top Stories/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest News" })).toBeVisible();
  // Relative times are client-only; their presence means hydration finished
  await expect(page.locator("article time").first()).toHaveText(/ago|just now/);
  await expect(page.getByText(/^Updated (just now|\d+m ago)$/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("tags categories on whole words only", async ({ page }) => {
  await page.goto("/");
  await expect(card(page, "Microsoft continues")).not.toContainText("Ransomware");
  await expect(card(page, "Open source project")).not.toContainText("Vulnerability");
  await expect(card(page, "APT29 targets")).toContainText("APT");
  await expect(card(page, "LockBit ransomware")).toContainText("Ransomware");
});

test("grid/list toggle applies immediately and persists", async ({ page }) => {
  await page.goto("/");
  const grid = page.locator("section", { has: page.getByRole("heading", { name: "Latest News" }) }).locator("> div").first();
  await expect(grid).toHaveClass(/grid/);

  await page.getByRole("button", { name: "Switch to list view" }).click();
  await expect(grid).toHaveClass(/flex-col/);

  await page.reload();
  await expect(grid).toHaveClass(/flex-col/);
});

test("clicking a card opens the article and marks it read", async ({ page, context }) => {
  await page.goto("/");
  const lockbit = card(page, "LockBit ransomware");
  // Click the description (not the link itself) to exercise the stretched
  // link overlay; mouse coordinates must be inside the viewport
  await lockbit.scrollIntoViewIfNeeded();
  const box = await lockbit.locator("p").boundingBox();
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2),
  ]);
  expect(popup.url()).toBe("https://example.com/a2");
  await expect(lockbit.getByText("read", { exact: true })).toBeVisible();
});

test("bookmarks persist and appear on the saved page", async ({ page, context }) => {
  await page.goto("/");
  let opened = false;
  context.on("page", () => (opened = true));

  await card(page, "LockBit ransomware").getByRole("button", { name: "Save for later" }).click();
  expect(opened).toBe(false);
  await page.reload();
  await expect(card(page, "LockBit ransomware").getByRole("button", { name: "Remove bookmark" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove bookmark" }).click();
  await expect(page.getByText("No saved articles yet.")).toBeVisible();
});

test("corrupted bookmark storage doesn't break the page", async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "cyber-pulse-bookmarks",
      // Only the last entry is usable: a minimal object from an older format
      JSON.stringify([null, 42, { title: "no link" }, { title: "Minimal bookmark", link: "https://example.com/min" }])
    );
    localStorage.setItem("cyber-pulse-read", JSON.stringify([null, 7]));
  });
  await page.goto("/");
  await expect(page.locator("article time").first()).toBeVisible();
  await page.goto("/saved");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Minimal bookmark" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("middle-click marks a card read; right-click doesn't", async ({ page, context }) => {
  await page.goto("/");
  // Wait for hydration so the handlers are attached
  await expect(page.locator("article time").first()).toHaveText(/ago|just now/);

  const lockbit = card(page, "LockBit ransomware");
  await lockbit.getByRole("link").click({ button: "right" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await expect(lockbit.getByText("read", { exact: true })).toHaveCount(0);

  const apt = card(page, "APT29 targets");
  const popup = context.waitForEvent("page");
  await apt.getByRole("link").click({ button: "middle" });
  await popup;
  await expect(apt.getByText("read", { exact: true })).toBeVisible();
});

test("search and category filters sync to the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search articles" }).fill("lockbit");
  await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("1 result");
  await expect(page).toHaveURL(/\?q=lockbit/);

  // Search also matches the source name, not just title/description
  // (every fixture article comes from "Fixture Feed")
  await page.getByRole("searchbox", { name: "Search articles" }).fill("fixture feed");
  await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("23 results");

  await page.getByRole("button", { name: "Clear ×" }).click();
  const chip = page.getByRole("button", { name: "Ransomware", exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/cat=Ransomware/);

  // A shared URL defines the whole filter: the saved Ransomware category
  // must not be applied on top of it
  await page.goto("/?q=fortios");
  await expect(page.getByRole("button", { name: "Ransomware", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("1 result");
});

test("marks articles published since the last visit as NEW", async ({ page }) => {
  // Fixture articles are 10 min, 57 min, 1h44m ... old; last visit 2h ago
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("cyber-pulse-previous-visit")) {
      localStorage.setItem("cyber-pulse-last-visit", String(Date.now() - 2 * 3600e3));
    }
  });
  await page.goto("/");
  await expect(card(page, "Attackers adapt").getByText("NEW", { exact: true })).toBeVisible();
  await expect(card(page, "Ivanti Connect Secure").getByText("NEW", { exact: true })).toHaveCount(0);

  // Still marked after a reload in the same session
  await page.reload();
  await expect(card(page, "Attackers adapt").getByText("NEW", { exact: true })).toBeVisible();
});

test("the visit is recorded when the page is hidden, not when it opens", async ({ page }) => {
  await page.goto("/");
  await page.locator("article time").first().waitFor();
  expect(await page.evaluate(() => localStorage.getItem("cyber-pulse-last-visit"))).toBeNull();

  const before = Date.now();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const stored = Number(await page.evaluate(() => localStorage.getItem("cyber-pulse-last-visit")));
  expect(stored).toBeGreaterThanOrEqual(before - 1000);
});

test("first visit shows no NEW badges", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article time").first()).toBeVisible();
  await expect(page.getByText("NEW", { exact: true })).toHaveCount(0);
});

test("CVE chip opens the detail dialog without leaving the page", async ({ page, context }) => {
  await page.goto("/");
  let opened = false;
  context.on("page", () => (opened = true));
  // Enriched at build time from the fixture NVD
  await page.getByRole("button", { name: /CVE-2024-23897 details, CVSS 9\.8 critical/ }).click();
  const dialog = page.getByRole("dialog", { name: "CVE-2024-23897" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Fixture description for CVE-2024-23897.")).toBeVisible();
  await expect(dialog.getByText("CRITICAL")).toBeVisible();
  expect(opened).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("closing the CVE dialog returns focus to its chip", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article time").first()).toHaveText(/ago|just now/);
  const chip = page.getByRole("button", { name: /CVE-2024-23897 details/ });
  for (const closeWith of ["Escape", "button"] as const) {
    await chip.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "CVE-2024-23897" });
    await expect(dialog).toBeVisible();
    if (closeWith === "Escape") await page.keyboard.press("Escape");
    else await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(chip).toBeFocused();
  }
});

test("keyboard users can skip to content; nav marks the current page", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page.getByRole("link", { name: "Feed", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("a button, a a")).toHaveCount(0);
});

test("pressing / focuses search, but not while typing elsewhere", async ({ page }) => {
  await page.goto("/");
  await page.locator("article time").first().waitFor();
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Search articles" });
  await expect(search).toBeFocused();
  await page.keyboard.type("a/b");
  await expect(search).toHaveValue("a/b");
});

test("Load more moves focus to the first new article", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article time").first()).toHaveText(/ago|just now/);
  const latest = page.locator("section", { has: page.getByRole("heading", { name: "Latest News" }) });
  await expect(latest.locator("article")).toHaveCount(12);

  await page.getByRole("button", { name: /Load more/ }).click();
  await expect(latest.locator("article")).toHaveCount(18);
  await expect(latest.locator("article").nth(12).getByRole("link")).toBeFocused();
});

test.describe("accessibility (axe-core)", () => {
  const states: Array<[string, (page: Page) => Promise<void>]> = [
    ["home", async (page) => { await page.goto("/"); }],
    ["filtered list view", async (page) => {
      await page.goto("/?cat=Ransomware");
      await page.getByRole("button", { name: "Switch to list view" }).click();
    }],
    ["CVE dialog", async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: /CVE-2024-23897 details/ }).click();
      // Audit the loaded state (score, vector, dates, references)
      await page.getByText("Fixture description for CVE-2024-23897.").waitFor();
    }],
    ["saved", async (page) => { await page.goto("/saved"); }],
  ];

  for (const [name, setup] of states) {
    test(`${name} has no violations`, async ({ page }) => {
      await setup(page);
      // Let client-only content (times, badges) render first
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
});

test("failed-feeds banner names the feeds and can be dismissed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article time").first()).toHaveText(/ago|just now/);
  const banner = page.getByRole("status").filter({ hasText: "Data may be incomplete" });
  await expect(banner).toContainText("Broken Feed A, Broken Feed B");

  await banner.getByRole("button", { name: "Dismiss warning" }).click();
  await expect(banner).toHaveCount(0);
  // Focus moves into the page instead of falling back to <body>
  await expect(page.locator("main")).toBeFocused();
});

test("sends security headers", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("JSON feed is public and reports failed feeds", async ({ request }) => {
  const res = await request.get("/api/feed.json");
  expect(res.headers()["access-control-allow-origin"]).toBe("*");
  const body = await res.json();
  expect(body.failedFeeds).toEqual(["Broken Feed A", "Broken Feed B"]);
  expect(body.count).toBe(body.featured.length + body.recent.length);
});

test("web app manifest is linked and valid", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "Cyber Pulse SG", start_url: "/", display: "standalone" });
});

test("RSS feed is served", async ({ request }) => {
  const res = await request.get("/api/feed.xml");
  expect(res.headers()["content-type"]).toContain("application/rss+xml");
  const body = await res.text();
  expect(body).toContain("<title>LockBit ransomware hits hospital network</title>");
  expect(body).toMatch(/<atom:link href="https?:\/\/[^"]+\/api\/feed\.xml"/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("trending strip filters articles", async ({ page }) => {
    await page.goto("/");
    const strip = page.getByRole("navigation", { name: "Trending in the last 24 hours" });
    await expect(strip).toBeVisible();
    const first = strip.getByRole("button").first();
    const term = (await first.getAttribute("title"))!.match(/"(.+)"/)![1];
    await first.click();
    await expect(page.getByRole("searchbox", { name: "Search articles" })).toHaveValue(term);
    await expect(page.getByRole("status").filter({ hasText: "result" })).not.toHaveText("0 results");
  });
});
