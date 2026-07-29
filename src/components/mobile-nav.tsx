import Link from "next/link";

const links = [
  ["Analyze", "/analyze/"],
  ["Word parts", "/parts/"],
  ["Sources", "/sources/"],
  ["Methodology", "/methodology/"],
] as const;

export function MobileNav() {
  return <div className="mobile-nav">
    <button className="button button-secondary menu-trigger" data-mobile-menu-trigger type="button" popoverTarget="mobile-menu">Menu</button>
    <div className="mobile-menu" data-mobile-menu id="mobile-menu" popover="auto">{links.map(([label, href]) => <Link key={href} href={href} prefetch={false}>{label}</Link>)}</div>
  </div>;
}
