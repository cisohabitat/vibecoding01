import { getArticles } from "@/lib/pipeline";
import { computeTrending } from "@/lib/trending";
import Header from "./components/Header";
import FeaturedNews from "./components/FeaturedNews";
import NewsList from "./components/NewsList";
import Footer from "./components/Footer";
import ArticleFilter from "./components/ArticleFilter";
import TrendingTopics from "./components/TrendingTopics";
import FeedFailureBanner from "./components/FeedFailureBanner";
import StatsBanner from "./components/StatsBanner";

export const revalidate = 900; // 15 minutes ISR

export default async function Home() {
  const { featured, recent, lastUpdated, failedFeeds } = await getArticles();
  const trending = computeTrending([...featured, ...recent]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="flex gap-8 items-start">
          <div className="flex-1 min-w-0">
            <FeedFailureBanner failedFeeds={failedFeeds} />
            <StatsBanner featured={featured} recent={recent} />
            <ArticleFilter featured={featured} recent={recent}>
              <FeaturedNews articles={featured} />
              <NewsList articles={recent} />
            </ArticleFilter>
          </div>
          <aside className="w-60 shrink-0 hidden lg:block sticky top-20">
            <TrendingTopics topics={trending} />
          </aside>
        </div>
      </main>
      <Footer lastUpdated={lastUpdated} />
    </div>
  );
}
