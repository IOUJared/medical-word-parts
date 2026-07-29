import Link from "next/link";
import type { ReactNode } from "react";

import { MobileNav } from "./mobile-nav";

const primaryLinks = [
  ["Analyze", "/analyze/"],
  ["Word parts", "/parts/"],
  ["Sources", "/sources/"],
  ["Methodology", "/methodology/"],
] as const;

export function AppShell({ children }: { readonly children: ReactNode }) {
  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="masthead">
      <nav className="nav-cluster" aria-label="Primary">
        <Link className="wordmark" href="/" prefetch={false}>Medical <strong>Word Parts</strong></Link>
        <div className="desktop-nav">{primaryLinks.map(([label, href]) => <Link key={href} href={href} prefetch={false}>{label}</Link>)}</div>
        <div className="nav-actions">
          <Link className="masthead-search" href="/analyze/" prefetch={false}>Search</Link>
          <button aria-pressed="false" className="button button-quiet theme-toggle" data-theme-toggle inert type="button">Dark mode</button>
          <MobileNav />
        </div>
      </nav>
    </header>
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="site-footer">
      <p><strong>For terminology learning and reference; not medical advice.</strong></p>
      <p>Analysis stays in your browser. Do not enter names, symptoms, record identifiers, or private medical details.</p>
      <nav aria-label="Footer"><Link href="/sources/" prefetch={false}>Sources</Link><Link href="/methodology/" prefetch={false}>Methodology</Link><Link href="/methodology/#corrections" prefetch={false}>Corrections</Link></nav>
    </footer>
  </div>;
}
