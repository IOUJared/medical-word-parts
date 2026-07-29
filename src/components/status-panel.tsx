import type { ReactNode } from "react";

import { AlertIcon, CheckIcon, InfoIcon, WarningIcon } from "./icons";

type StatusTone = "verified" | "derived" | "partial" | "unsupported" | "neutral" | "privacy";
type StatusPanelProps = {
  readonly tone: StatusTone;
  readonly label: string;
  readonly children: ReactNode;
  readonly live?: boolean;
};

function Marker({ tone }: { readonly tone: StatusTone }) {
  switch (tone) {
    case "verified":
      return <CheckIcon className="status-icon" />;
    case "derived":
    case "neutral":
    case "privacy":
      return <InfoIcon className="status-icon" />;
    case "partial":
      return <WarningIcon className="status-icon" />;
    case "unsupported":
      return <AlertIcon className="status-icon" />;
  }
}

export function StatusPanel({ tone, label, children, live = false }: StatusPanelProps) {
  const role = live ? (tone === "unsupported" ? "alert" : "status") : undefined;
  return <section className={`status-panel status-${tone}`} role={role}>
    <Marker tone={tone} />
    <div><p className="status-label">{label}</p><div>{children}</div></div>
  </section>;
}
