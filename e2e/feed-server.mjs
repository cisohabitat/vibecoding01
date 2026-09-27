// Serves a fixture RSS feed for the end-to-end tests. Dates are generated
// relative to request time so "breaking" and 24h ranking stay meaningful.
import { createServer } from "node:http";

const PORT = Number(process.env.FEED_PORT || 8765);

const TITLES = [
  "Microsoft continues Windows 10 extended support",
  "Attackers adapt phishing kits to bypass MFA",
  "LockBit ransomware hits hospital network",
  "Critical RCE in Jenkins CVE-2024-23897 exploited",
  "APT29 targets European embassies",
  "Open source project gets new maintainer",
  "Fortinet patches FortiOS authentication bypass",
  "Ivanti Connect Secure flaw under active attack",
  "Cisco warns of IOS XE privilege escalation",
  "Google fixes Chrome zero-day used in the wild",
  "Okta support system breach exposes customer data",
  "SonicWall firewall bug allows remote takeover",
  "Atlassian Confluence servers targeted by botnet",
  "Citrix NetScaler session hijacking warning",
  "VMware ESXi hosts encrypted by new ransomware strain",
  "GitHub tokens leaked in public repositories",
  "Apple patches WebKit memory corruption issue",
];

function rss() {
  const now = Date.now();
  const items = TITLES.map((title, i) => {
    const date = new Date(now - (i * 47 + 10) * 60_000).toUTCString();
    return `<item><title>${title}</title><link>https://example.com/a${i}</link><pubDate>${date}</pubDate><description>Story ${i}: ${title}.</description></item>`;
  });
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title>${items.join("")}</channel></rss>`;
}

createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/rss+xml" });
  res.end(rss());
}).listen(PORT, () => console.log(`fixture feed on :${PORT}`));
