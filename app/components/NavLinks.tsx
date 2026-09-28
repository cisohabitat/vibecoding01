"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Feed", icon: null },
  { href: "/saved", label: "Saved", icon: "★" },
  { href: "/about", label: "About", icon: null },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-3">
      {LINKS.map(({ href, label, icon }) => {
        const current = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`text-xs transition-colors flex items-center gap-1 ${
              current ? "text-cyber-accent" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {icon && <span aria-hidden="true">{icon}</span>}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
