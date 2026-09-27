// Waits until a URL responds (the fixture feed must be up before `next build`
// prerenders the page).
const url = process.argv[2];
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(url)).ok) process.exit(0);
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
console.error(`timed out waiting for ${url}`);
process.exit(1);
