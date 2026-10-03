import type { Metadata } from "next";
import Link from "next/link";
import Header from "../components/Header";
import { GLOSSARY } from "../components/glossary";
import { HIGH_EPSS } from "@/lib/epss-format";

const description =
  "New to cybersecurity? How to read Cyber Pulse SG's stories, scores and badges, and the jargon in plain English.";

export const metadata: Metadata = {
  title: "How to read Cyber Pulse",
  description,
  alternates: { canonical: "/guide" },
  // A page's openGraph replaces the layout's, so it's complete here
  openGraph: { type: "website", siteName: "Cyber Pulse SG", title: "How to read Cyber Pulse SG", description, url: "/guide" },
};

// Static look-alikes of the card badges (not buttons: nothing here is clickable)
const badge = "inline-block px-1.5 py-0.5 rounded border text-xs align-middle whitespace-nowrap";

export default function GuidePage() {
  const h2 = "text-lg font-semibold text-white mt-10 mb-3 scroll-mt-32";
  // Underlined: links in running text must stand out by more than colour
  const link = "text-cyber-accent underline underline-offset-2 hover:text-white";
  const term = "font-semibold text-slate-200";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" tabIndex={-1} className="outline-none flex-1 max-w-3xl mx-auto px-4 py-8 sm:px-6 w-full text-sm text-slate-300 leading-relaxed">
        <h1 className="text-2xl font-bold text-white mb-4">How to read Cyber Pulse</h1>
        <p>
          Cyber Pulse collects security news from trusted outlets every 15 minutes and puts the most important
          stories first. You don&rsquo;t need a security background to use it: this page explains what
          you&rsquo;ll see and what the jargon means.
        </p>

        <h2 id="reading" className={h2}>Reading the page</h2>
        <ul className="space-y-3">
          <li>
            <span className={term}>Top Stories</span> are the five most important stories of the last 24 hours.
            If you only read one thing, read these.
          </li>
          <li>
            <span className={`${badge} font-mono bg-cyber-accent/10 text-cyber-accent border-transparent`}>16.0</span>{" "}
            The green number on a Top Story is its <span className={term}>relevance score</span>: how important
            the story is today (trusted source, serious threat, actively attacked, widely reported, recent). Tap
            it to see how it adds up. It is not a severity rating.
          </li>
          <li>
            <span className={`${badge} font-mono bg-red-500/10 text-red-400 border-red-500/40`}>
              CVE-2024-3400 <b>9.8</b>
            </span>{" "}
            A <span className={term}>CVE chip</span> names a specific security flaw, with its severity out of 10.
            Red is critical (9+), orange high, amber medium. Tap it for a plain-English summary.
          </li>
          <li>
            <span className={`${badge} font-bold bg-red-500/25 text-red-200 border-transparent`}>KEV</span>{" "}
            means attackers are <span className={term}>already using</span> the flaw. These are the ones to fix
            first. Red is only ever used for this kind of urgency.
          </li>
          <li>
            <span className={`${badge} font-bold bg-orange-500/20 text-orange-200 border-transparent`}>EPSS 41%</span>{" "}
            is a forecast: the chance attackers start using the flaw in the next 30 days. It&rsquo;s shown when
            it&rsquo;s {Math.round(HIGH_EPSS * 100)}% or more and the flaw isn&rsquo;t already on the KEV list.
          </li>
          <li>
            <span className={`${badge} font-bold bg-amber-500/15 text-amber-300 border-amber-500/50`}>BREAKING</span>{" "}
            published in the last hour;{" "}
            <span className={`${badge} font-semibold bg-cyber-accent/15 text-cyber-accent border-transparent`}>NEW</span>{" "}
            published since your last visit;{" "}
            <span className={`${badge} font-semibold border-slate-400/40 text-slate-200`}>SG</span> mentions
            Singapore;{" "}
            <span className={`${badge} font-semibold border-cyber-blue/40 text-cyber-blue`}>STACK</span> mentions
            something you use (see below).
          </li>
          <li>
            The coloured labels at the bottom of a card are the <span className={term}>source</span> and the{" "}
            <span className={term}>category</span> (Ransomware, Phishing…). Tap one to see more like it.
          </li>
          <li>
            The numbers at the top (critical flaws, exploited flaws, breaches, ransomware) count the last 24
            hours. Tap one to see those stories.
          </li>
        </ul>

        <h2 id="what-to-do" className={h2}>What should I do with it?</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            If a red or <span className={term}>KEV</span> story names software you or your organisation use,
            install the update, or tell whoever looks after your IT, today.
          </li>
          <li>
            Add the products you use under <span className={term}>My stack</span> (in the filters). Stories that
            mention them get a STACK badge, and the My stack filter shows only those.
          </li>
          <li>
            Phishing and breach stories are a reminder to turn on <Link href="#mfa" className={link}>MFA</Link>{" "}
            and watch for fake emails, especially ones that copy a company in the news.
          </li>
          <li>
            Only want the must-act alerts? Subscribe to the{" "}
            {/* An XML route handler, not a page: a <Link> would try client-side navigation */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/feed/kev" className={link}>known exploited RSS feed</a> in a feed reader or chat
            channel.
          </li>
        </ul>

        <h2 id="glossary" className={h2}>Jargon explained</h2>
        <dl className="space-y-3">
          {GLOSSARY.map(({ id, term: name, meaning }) => (
            <div key={id} id={id} className="scroll-mt-32 target:rounded-lg target:bg-cyber-700/50 target:-mx-3 target:px-3 target:py-2">
              <dt className={term}>{name}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-10">
          How stories are scored, where they come from and what&rsquo;s stored:{" "}
          <Link href="/about" className={link}>About Cyber Pulse SG</Link>.
        </p>
        <p className="mt-4">
          <Link href="/" className={link}>← Back to the news</Link>
        </p>
      </main>
    </div>
  );
}
