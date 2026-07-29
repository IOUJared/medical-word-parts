import Link from "next/link";

type Crumb = { readonly label: string; readonly href?: string };

export function Breadcrumbs({ items }: { readonly items: readonly Crumb[] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol>{items.map((item) => <li key={item.href ?? item.label}>{item.href === undefined ? <span aria-current="page">{item.label}</span> : <Link href={item.href} prefetch={false}>{item.label}</Link>}</li>)}</ol></nav>;
}
