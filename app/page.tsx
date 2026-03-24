import { fetchAllFeeds } from "@/lib/fetcher";
import { tagArticles } from "@/lib/tagger";
import { deduplicateArticles } from "@/lib/deduplicator";
import { rankArticles } from "@/lib/ranker";
import Header from "./components/Header";
import FeaturedNews from "./components/FeaturedNews";
import NewsList from "./components/NewsList";
import Footer from "./components/Footer";

export const dynamic = "force-dynamic";
export const revalidate = 900; // 15 minutes ISR

export default async function Home() {
  const raw = await fetchAllFeeds();
  const tagged = tagArticles(raw);
  const deduped = deduplicateArticles(tagged);
  const { featured, recent, lastUpdated } = rankArticles(deduped);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full">
        <FeaturedNews articles={featured} />
        <NewsList articles={recent} />
      </main>
      <Footer lastUpdated={lastUpdated} />
    </div>
  );
}
