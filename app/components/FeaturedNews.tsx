import { Article } from "@/lib/types";
import FeaturedGrid from "./FeaturedGrid";

export default function FeaturedNews({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return (
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse" />
          Top Stories
        </h2>
        <p className="text-slate-400 text-sm">
          No featured stories in the last 24 hours.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse" />
        Top Stories — Last 24 Hours
      </h2>
      <FeaturedGrid articles={articles} />
    </section>
  );
}
