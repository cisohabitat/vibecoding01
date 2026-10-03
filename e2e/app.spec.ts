import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Request } from "@playwright/test";

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

test("counts known-exploited CVEs and ranks their story first", async ({ page }) => {
  await page.goto("/");
  const stat = page.getByRole("group", { name: "Last 24 hours" }).getByRole("button", { name: "1 Exploited CVEs" });
  await expect(stat).toBeVisible();
  // The KEV boost puts the Jenkins story at the top of Top Stories
  const top = page.locator("section", { has: page.getByRole("heading", { name: /Top Stories/ }) }).locator("article").first();
  await expect(top).toContainText("Critical RCE in Jenkins");
  // ...and its score explains itself
  await expect(top.getByText("16.0")).toHaveAttribute("title", /^Relevance score: Source 2 · Keywords \+\d+ · Recency \+\d.* · Exploitation \+3/);
  // ...also on tap, for touch and keyboard users
  await top.getByRole("button", { name: /^Relevance score 16\.0/ }).click();
  await expect(top.getByRole("note")).toContainText("Exploitation+3");
  await expect(top.getByRole("note")).toContainText("Total16.0");

  // The tile shows its stories: last 24h, known exploited
  await stat.click();
  await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("2 results");
  // Focus follows to the results, so keyboard/screen-reader users land there
  await expect(page.locator("#filtered-heading")).toBeFocused();
  await expect(page).toHaveURL(/t=24/);
  await expect(page).toHaveURL(/f=kev/);
  await page.getByRole("group", { name: "Last 24 hours" }).getByRole("button", { name: /Ransomware/ }).click();
  await expect(page).toHaveURL(/cat=Ransomware/);
  await expect(page).not.toHaveURL(/f=kev/);
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
  // Top Stories follow the toggle too
  const top = page.locator("section", { has: page.getByRole("heading", { name: /Top Stories/ }) }).locator("> div").first();
  await expect(grid).toHaveClass(/grid/);
  await expect(top).toHaveClass(/grid/);

  await page.getByRole("button", { name: "Switch to list view" }).click();
  await expect(grid).toHaveClass(/flex-col/);
  await expect(top).toHaveClass(/flex-col/);

  await page.reload();
  await expect(grid).toHaveClass(/flex-col/);
  await expect(top).toHaveClass(/flex-col/);
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

test("saved stories copy as a briefing, and Clear all can be undone", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await card(page, "Critical RCE in Jenkins").getByRole("button", { name: "Save for later" }).click();
  await card(page, "LockBit ransomware").getByRole("button", { name: "Save for later" }).click();

  await page.goto("/saved");
  await page.getByRole("button", { name: "Copy as briefing" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Briefing copied" })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^\*\*Security briefing, \d{4}-\d{2}-\d{2}\*\* \(2 stories\)/);
  // Newest bookmark first, with CVE notes from NVD and KEV
  expect(text).toContain("1. LockBit ransomware hits hospital network (Fixture Feed,");
  expect(text).toContain("CVE-2024-23897: CVSS 9.8, known exploited (CISA KEV)");

  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.locator("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("article")).toHaveCount(2);
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

  // ...and visiting it doesn't erase the saved choice: a bare URL restores it
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Ransomware", exact: true })).toHaveAttribute("aria-pressed", "true");
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

  // 10 min, 57 min and 1h44m old: three new stories, which can be dismissed
  await expect(page.getByText("3 new since your last visit")).toBeVisible();
  await page.getByRole("button", { name: "Mark all seen" }).click();
  await expect(page.getByText("NEW", { exact: true })).toHaveCount(0);
  await expect(page.getByText("since your last visit")).toHaveCount(0);
  await page.reload();
  await page.locator("article time").first().waitFor();
  await expect(page.getByText("NEW", { exact: true })).toHaveCount(0);
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

test("a long-lived tab starts a new visit after being away", async ({ page }) => {
  const DAY = 24 * 3600e3;
  // Baseline from when the tab was opened two days ago; left 2h ago
  await page.addInitScript((day) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      sessionStorage.setItem("cyber-pulse-previous-visit", String(Date.now() - 2 * day));
      localStorage.setItem("cyber-pulse-last-visit", String(Date.now() - 2 * 3600e3));
    }
  }, DAY);
  await page.goto("/");
  // Reload after 2h away: only stories from the last 2h are NEW (not 2 days)
  await expect(card(page, "Attackers adapt").getByText("NEW", { exact: true })).toBeVisible();
  await expect(card(page, "Ivanti Connect Secure").getByText("NEW", { exact: true })).toHaveCount(0);
});

test("returning to an open tab after a long absence moves the NEW baseline", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      const twoDaysAgo = String(Date.now() - 2 * 24 * 3600e3);
      sessionStorage.setItem("cyber-pulse-previous-visit", twoDaysAgo);
      localStorage.setItem("cyber-pulse-last-visit", twoDaysAgo);
    }
  });
  await page.goto("/");
  const ivanti = card(page, "Ivanti Connect Secure").getByText("NEW", { exact: true });
  await expect(ivanti).toBeVisible();

  // The tab was hidden 2h ago and is now visible again
  await page.evaluate(() => {
    localStorage.setItem("cyber-pulse-last-visit", String(Date.now() - 2 * 3600e3));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(ivanti).toHaveCount(0);
  await expect(card(page, "Attackers adapt").getByText("NEW", { exact: true })).toBeVisible();
});

test("first visit shows no NEW badges", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article time").first()).toBeVisible();
  await expect(page.getByText("NEW", { exact: true })).toHaveCount(0);
});

test("triage filters narrow to CVE, KEV and CVSS 9+ stories", async ({ page }) => {
  await page.goto("/");
  const results = page.getByRole("status").filter({ hasText: "result" });

  await page.getByRole("button", { name: "Only flaws attackers are already using (CISA KEV)" }).click();
  await expect(results).toHaveText("2 results");
  await expect(page.locator("article")).toContainText(["Critical RCE in Jenkins"]);
  await expect(page).toHaveURL(/f=kev/);

  await page.getByRole("button", { name: "Clear ×" }).click();
  await page.getByRole("button", { name: "Only critical flaws, rated 9 or more out of 10" }).click();
  await expect(results).toHaveText("3 results");

  // A shared triage link restores the filter
  await page.goto("/?f=cve");
  await expect(page.getByRole("button", { name: "Only stories naming a specific flaw (CVE)" })).toHaveAttribute("aria-pressed", "true");
  await expect(results).toHaveText("3 results");
});

test("newcomers get the jargon explained without hovering", async ({ page }) => {
  await page.goto("/");
  // Jargon filters say what they mean where they're used (tooltips never reach phones)
  const showOnly = page.getByRole("group", { name: "Show only" });
  await showOnly.getByRole("button", { name: /^KEV/ }).click();
  await expect(page.getByText("KEV: flaws attackers are already using (CISA's list)")).toBeVisible();
  await page.getByRole("button", { name: /^CVSS 9\+/ }).click();
  await expect(page.getByText(/CVSS 9\+: flaws rated critical: 9 or more out of 10/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Jargon explained" })).toHaveAttribute("href", "/guide#kev");

  // The CVE dialog links to the glossary
  await page.goto("/");
  await page.getByRole("button", { name: /^CVE-2024-23897 details/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("severity (CVSS)")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "What do these terms mean?" })).toHaveAttribute("href", "/guide#glossary");
  await page.keyboard.press("Escape");

  // The guide is one tap from the home page, and its anchors land on the term
  await page.getByRole("link", { name: "New here? Read the guide" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to read Cyber Pulse");
  await page.goto("/guide#kev");
  const kev = page.locator("#kev");
  await expect(kev).toContainText("attackers are confirmed to be using");
  // Not hidden under the sticky header
  const headerBottom = await page.locator("header").evaluate((h) => h.getBoundingClientRect().bottom);
  expect((await kev.boundingBox())!.y).toBeGreaterThanOrEqual(headerBottom);
});

test("My stack: watchlist marks and filters matching stories", async ({ page }) => {
  await page.goto("/");
  const results = page.getByRole("status").filter({ hasText: "result" });

  // Turning on an empty stack opens the editor and explains the empty result
  await page.getByRole("button", { name: "Only stories about your stack" }).click();
  await expect(page.getByText("Your stack is empty")).toBeVisible();
  const input = page.getByLabel("Add vendors or products to your stack");
  await expect(input).toBeFocused();

  await input.fill("Fortinet, ivanti , x");
  await input.press("Enter");
  const list = page.getByRole("list", { name: "Your stack" });
  // Too-short terms are dropped; case is kept as typed
  await expect(list.getByRole("listitem")).toHaveText(["Fortinet×", "ivanti×"]);
  await expect(results).toHaveText("2 results");
  await expect(page).toHaveURL(/f=stack/);
  await expect(page.locator("article").filter({ hasText: "STACK" })).toHaveCount(2);

  await page.getByRole("button", { name: "Remove Fortinet" }).click();
  await expect(results).toHaveText("1 result");
  await expect(input).toBeFocused();
  await expect(page.locator("article")).toContainText(["Ivanti Connect Secure"]);

  // Saved across visits; cards are marked on the unfiltered page too
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Edit stack (1)" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "STACK" })).toHaveCount(1);
});

test("a notice counts new stories about your stack since the last visit", async ({ page }) => {
  // Last visit 6h ago: Fortinet (~5h old) is new, SonicWall (~9h old) isn't
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("cyber-pulse-previous-visit")) {
      localStorage.setItem("cyber-pulse-last-visit", String(Date.now() - 6 * 3600e3));
      localStorage.setItem("cyber-pulse-watchlist", JSON.stringify(["Fortinet", "SonicWall"]));
      localStorage.setItem("cyber-pulse-category", JSON.stringify(["Vulnerability"]));
    }
  });
  await page.goto("/");
  const savedCategory = JSON.stringify(["Vulnerability"]);
  const notice = page.getByText("1 new story mentions your stack since your last visit.");
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "Show it", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("2 results");
  // Newest first, so the new story leads
  await expect(page.locator("article").first()).toContainText("Fortinet");
  await expect(page).toHaveURL(/f=stack/);
  await expect(notice).toHaveCount(0);
  // A view change: the reader's saved categories are untouched
  expect(await page.evaluate(() => localStorage.getItem("cyber-pulse-category"))).toBe(savedCategory);
});

test("filtered results can be sorted and are paginated", async ({ page }) => {
  await page.goto("/?q=fixture+feed");
  const results = page.getByRole("status").filter({ hasText: "result" });
  await expect(results).toHaveText("23 results");
  const section = page.locator("section[aria-labelledby=filtered-heading]");
  // Paginated like the default list
  await expect(section.locator("article")).toHaveCount(12);
  await section.getByRole("button", { name: /Load more/ }).click();
  await expect(section.locator("article")).toHaveCount(23);

  // Newest first by default; Top puts the KEV-boosted Jenkins story first
  await expect(section.locator("article").first()).toContainText("Microsoft continues");
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await expect(section.locator("article").first()).toContainText("Critical RCE in Jenkins");
  await expect(page).toHaveURL(/sort=top/);
});

test("CVE chip opens the detail dialog without leaving the page", async ({ page, context }) => {
  await page.goto("/");
  let opened = false;
  context.on("page", () => (opened = true));
  // Enriched from the fixture NVD and KEV catalog
  const chip = card(page, "Critical RCE in Jenkins").getByRole("button", {
    name: /CVE-2024-23897 details, CVSS 9\.8 critical, known exploited \(CISA KEV\), used in ransomware/,
  });
  await expect(chip).toContainText("KEV");
  await chip.click();
  const dialog = page.getByRole("dialog", { name: "CVE-2024-23897" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Fixture description for CVE-2024-23897.")).toBeVisible();
  await expect(dialog.getByText("CRITICAL")).toBeVisible();
  await expect(dialog.getByText("Known exploited.")).toBeVisible();
  // The catalog's details
  await expect(dialog).toContainText(/Added 19 Aug 2024\. US federal deadline to patch: 9 Sept? 2024\./);
  await expect(dialog.getByText("Known to be used in ransomware campaigns.")).toBeVisible();
  // NVD dates in the same unambiguous format
  await expect(dialog).toContainText("Published: 24 Jan 2024");
  // Other current stories naming the same CVE
  const others = dialog.getByRole("heading", { name: "In other stories" }).locator("xpath=..");
  await expect(others.getByRole("link", { name: "New Android spyware poses as messaging app" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Known Exploited Vulnerabilities catalog" })).toHaveAttribute(
    "href",
    /cisa\.gov\/known-exploited-vulnerabilities-catalog\?search_api_fulltext=CVE-2024-23897/
  );
  expect(opened).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("high EPSS is flagged on the chip and explained in the dialog", async ({ page }) => {
  await page.goto("/");
  // Not in KEV, but the fixture EPSS gives it 41%
  const chip = page.getByRole("button", { name: /CVE-2024-3400 details, .*41% chance of exploitation \(EPSS\)/ });
  await expect(chip).toContainText("EPSS 41%");
  // KEV CVEs show KEV, not EPSS as well
  await expect(page.getByRole("button", { name: /CVE-2024-23897 details/ }).first()).not.toContainText("EPSS");
  await chip.click();
  const dialog = page.getByRole("dialog", { name: "CVE-2024-3400" });
  await expect(dialog).toContainText("41% chance of exploitation in the next 30 days (98th percentile)");
  await expect(dialog.getByText("Known exploited.")).toHaveCount(0);
});

test("closing the CVE dialog returns focus to its chip", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article time").first()).toHaveText(/ago|just now/);
  const chip = card(page, "Critical RCE in Jenkins").getByRole("button", { name: /CVE-2024-23897 details/ });
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

test("an open tab refreshes its data once it is older than 15 minutes", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("article time").first()).toHaveText(/ago|just now/);

  // router.refresh() is an RSC request for the page. Link prefetches (the
  // header links to "/", re-prefetched when Next's 5-minute prefetch cache
  // expires) are RSC requests too, so they're excluded.
  const isRefresh = (r: Request) =>
    r.headers()["rsc"] === "1" && !r.headers()["next-router-prefetch"] && new URL(r.url()).pathname === "/";

  // Fresh data: no refresh request
  let refreshes = 0;
  page.on("request", (r) => {
    if (isRefresh(r)) refreshes++;
  });
  await page.clock.runFor(5 * 60_000);
  expect(refreshes).toBe(0);

  // 16 minutes later the next clock tick triggers router.refresh()
  const refresh = page.waitForRequest(isRefresh);
  await page.clock.runFor(11 * 60_000);
  await refresh;
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

test("stories about Singapore are marked SG", async ({ page }) => {
  await page.goto("/?q=bulletproof");
  await expect(card(page, "Police dismantle").getByText("SG", { exact: true })).toBeVisible();
  await page.goto("/?q=lockbit");
  await expect(card(page, "LockBit ransomware").getByText("SG", { exact: true })).toHaveCount(0);
});

test("a card's source and category labels show matching stories", async ({ page }) => {
  await page.goto("/");
  const results = page.getByRole("status").filter({ hasText: "result" });
  await card(page, "LockBit ransomware").getByRole("button", { name: /^Ransomware: show all/ }).click();
  await expect(page).toHaveURL(/cat=Ransomware/);
  await expect(results).toHaveText("2 results");
  await expect(page.locator("#filtered-heading")).toBeFocused();

  await card(page, "LockBit ransomware").getByRole("button", { name: /^Fixture Feed: show its stories/ }).click();
  // A source filter, not a text search
  await expect(page).toHaveURL(/src=Fixture\+Feed/);
  await expect(page.getByRole("searchbox", { name: "Search articles" })).toHaveValue("");
  await expect(page.getByText("Stories from Fixture Feed")).toBeVisible();
  await expect(results).toHaveText("23 results");
  await page.getByRole("button", { name: "Remove source filter: Fixture Feed" }).click();
  await expect(page).not.toHaveURL(/src=/);
});

test("labels on the saved page are plain text", async ({ page }) => {
  await page.goto("/");
  await card(page, "LockBit ransomware").getByRole("button", { name: "Save for later" }).click();
  await page.goto("/saved");
  await expect(page.locator("article").getByText("Ransomware", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /show all Ransomware stories/ })).toHaveCount(0);
});

test("the same story from two outlets is shown once, crediting both", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article", { hasText: /LockBit/ })).toHaveCount(1);
  await expect(card(page, "LockBit ransomware hits hospital network")).toContainText("also: Fixture Wire");
  // The source filter includes stories an outlet also reported
  await page.goto("/?src=Fixture+Wire");
  await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("1 result");
});

test("the About page explains sources, ranking and privacy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "About Cyber Pulse SG" })).toBeVisible();
  // Sources come from the feed list, numbers from the ranking code
  await expect(page.getByRole("main").getByText("Fixture Feed", { exact: true })).toBeVisible();
  await expect(page.getByText(/\+3 for a CVE in CISA/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
});

test("j and k move between stories", async ({ page }) => {
  await page.goto("/");
  await page.locator("article time").first().waitFor();
  const titles = page.locator("#article-filter article h3 a");
  await page.keyboard.press("j");
  await expect(titles.nth(0)).toBeFocused();
  await page.keyboard.press("j");
  await expect(titles.nth(1)).toBeFocused();
  await page.keyboard.press("k");
  await expect(titles.nth(0)).toBeFocused();
  // Not while typing
  await page.getByRole("searchbox", { name: "Search articles" }).focus();
  await page.keyboard.press("j");
  await expect(page.getByRole("searchbox", { name: "Search articles" })).toHaveValue("j");
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
      await card(page, "Critical RCE in Jenkins").getByRole("button", { name: /CVE-2024-23897 details/ }).click();
      // Audit the loaded state (score, vector, dates, references)
      await page.getByText("Fixture description for CVE-2024-23897.").waitFor();
    }],
    ["stack editor", async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Set up stack" }).click();
      await page.getByLabel("Add vendors or products to your stack").fill("Fortinet, Ivanti");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Only stories about your stack" }).click();
    }],
    ["saved", async (page) => { await page.goto("/saved"); }],
    ["about", async (page) => { await page.goto("/about"); }],
    ["guide", async (page) => { await page.goto("/guide#kev"); }],
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

test("sends security headers with a per-request CSP nonce", async ({ request }) => {
  const [a, b] = await Promise.all([request.get("/"), request.get("/")]);
  const csp = a.headers()["content-security-policy"];
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
  expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(csp).toContain("frame-ancestors 'none'");
  // A fresh nonce on every request
  const nonce = (h: string) => /'nonce-([^']+)'/.exec(h)![1];
  expect(nonce(csp)).not.toBe(nonce(b.headers()["content-security-policy"]));

  const headers = a.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["strict-transport-security"]).toBe("max-age=63072000");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

for (const path of ["/", "/saved", "/about", "/guide", "/does-not-exist"]) {
  test(`no CSP violations and every script nonced on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to (execute|load)/.test(m.text()) && !/_vercel/.test(m.text())) {
        violations.push(m.text());
      }
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
    // Every script from the server carries the nonce; Vercel Analytics and
    // Speed Insights are injected from JS and allowed via 'strict-dynamic'
    const unnonced = await page.evaluate(() =>
      [...document.querySelectorAll("script")]
        .filter((s) => !s.nonce && !s.src.includes("/_vercel/"))
        .map((s) => s.src || s.textContent?.slice(0, 40))
    );
    expect(unnonced).toEqual([]);
  });
}

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

test("CVE API only serves CVEs the site shows", async ({ request }) => {
  const untracked = await request.get("/api/cve/CVE-2020-0001");
  expect(untracked.status()).toBe(404);
  expect(await untracked.json()).toEqual({ error: "CVE not tracked" });
  const tracked = await request.get("/api/cve/CVE-2024-23897");
  expect(tracked.status()).toBe(200);
  expect(await tracked.json()).toMatchObject({ id: "CVE-2024-23897", kev: true, epss: 0.94462, epssPercentile: 0.9995 });
});

test("RSS feed is served", async ({ request }) => {
  const res = await request.get("/api/feed.xml");
  expect(res.headers()["content-type"]).toContain("application/rss+xml");
  const body = await res.text();
  expect(body).toContain("<title>LockBit ransomware hits hospital network</title>");
  expect(body).toMatch(/<atom:link href="https?:\/\/[^"]+\/api\/feed\.xml"/);
});

test("filtered RSS feeds carry only matching stories", async ({ request }) => {
  const kev = await request.get("/api/feed/kev");
  expect(kev.headers()["content-type"]).toContain("application/rss+xml");
  const body = await kev.text();
  expect(body).toContain("<title>Critical RCE in Jenkins CVE-2024-23897 exploited</title>");
  expect(body).not.toContain("LockBit");
  expect(body).toMatch(/<atom:link href="https?:\/\/[^"]+\/api\/feed\/kev"/);

  const critical = await (await request.get("/api/feed/critical")).text();
  expect(critical.match(/<item>/g)).toHaveLength(3);

  const sg = await (await request.get("/api/feed/sg")).text();
  expect(sg).toContain("Police dismantle bulletproof hosting provider");
  expect(sg.match(/<item>/g)).toHaveLength(1);

  expect((await request.get("/api/feed/nope")).status()).toBe(404);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("filters fold behind a toggle; the CVE dialog fits the screen", async ({ page }) => {
    await page.goto("/");
    const kev = page.getByRole("button", { name: /^KEV: / });
    await expect(kev).toBeHidden();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await kev.click();
    await expect(page.getByRole("button", { name: "Filters (1 on)" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("2 results");

    await card(page, "Critical RCE in Jenkins").getByRole("button", { name: /CVE-2024-23897 details/ }).click();
    const box = (await page.getByRole("dialog").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(390 - 8);
  });

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
