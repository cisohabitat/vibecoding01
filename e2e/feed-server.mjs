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
  "Zyxel NAS devices hit by credential stuffing",
  "Researchers detail Bluetooth pairing weakness",
  "npm package typosquats popular logging library",
  "Microsoft Teams used to deliver remote access tool",
  "Police dismantle bulletproof hosting provider",
  "New Android spyware poses as messaging app",
];

function rss() {
  const now = Date.now();
  const items = TITLES.map((title, i) => {
    const date = new Date(now - (i * 47 + 10) * 60_000).toUTCString();
    return `<item><title>${title}</title><link>https://example.com/a${i}</link><pubDate>${date}</pubDate><description>Story ${i}: ${title}.</description></item>`;
  });
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title>${items.join("")}</channel></rss>`;
}

// Minimal NVD CVE API response, so CVE enrichment and the CVE dialog are
// tested without depending on the live (rate-limited) NVD
function nvd(cveId) {
  return JSON.stringify({
    vulnerabilities: [
      {
        cve: {
          id: cveId,
          published: "2024-01-24T18:15:09.370",
          lastModified: "2024-06-10T17:16:21.000",
          descriptions: [{ lang: "en", value: `Fixture description for ${cveId}.` }],
          metrics: {
            cvssMetricV31: [
              { cvssData: { baseScore: 9.8, baseSeverity: "CRITICAL", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" } },
            ],
          },
          references: [{ url: "https://example.com/advisory" }],
        },
      },
    ],
  });
}

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/nvd") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(nvd(url.searchParams.get("cveId")));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/rss+xml" });
  res.end(rss());
}).listen(PORT, () => console.log(`fixture feed on :${PORT}`));
