import Link from "next/link";
import Header from "./components/Header";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-cyber-accent font-mono text-sm">404</p>
        <h1 className="text-2xl font-bold text-white">Page not found</h1>
        <Link
          href="/"
          className="px-4 py-2 text-sm border border-cyber-600/50 text-slate-300 rounded-lg hover:border-cyber-500 transition-colors"
        >
          ← Back to the feed
        </Link>
      </main>
    </div>
  );
}
