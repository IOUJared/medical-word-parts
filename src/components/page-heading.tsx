import type { ReactNode } from "react";

export function PageHeading({ overline, title, children }: { readonly overline: string; readonly title: string; readonly children: ReactNode }) {
  return <header className="page-heading"><p className="overline">{overline}</p><h1>{title}</h1><div className="lead">{children}</div></header>;
}
