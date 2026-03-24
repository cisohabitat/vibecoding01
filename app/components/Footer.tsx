export default function Footer({ lastUpdated }: { lastUpdated: string }) {
  const time = new Date(lastUpdated).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <footer className="mt-16 border-t border-cyber-600 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
        <p>
          Aggregated from CISA, Krebs on Security, BleepingComputer, The Hacker
          News, Dark Reading, SecurityWeek, and more.
        </p>
        <p className="mt-1">
          Last updated: {time} UTC — Feeds refresh every 15 minutes
        </p>
      </div>
    </footer>
  );
}
