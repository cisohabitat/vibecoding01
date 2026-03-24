export default function Header() {
  return (
    <header className="border-b border-cyber-600 bg-cyber-800/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-cyber-accent animate-pulse-glow" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-cyber-accent blur-sm" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            <span className="text-cyber-accent">Cyber</span>{" "}
            <span className="text-white">Pulse SG</span>
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-400 ml-6">
          Real-time cybersecurity intelligence — auto-ranked from trusted sources
        </p>
      </div>
    </header>
  );
}
