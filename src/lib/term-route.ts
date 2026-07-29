import { termRouteIndex } from "../generated/index";

export type TermRouteDecision =
  | { readonly kind: "term"; readonly href: `/term/${string}/` }
  | { readonly kind: "analyze"; readonly href: `/analyze/?term=${string}` };

export function decideTermRoute(input: string): TermRouteDecision {
  const normalized = input.normalize("NFKC").trim().toLowerCase();
  const route = Object.entries(termRouteIndex).find(([term]) => term === normalized);
  if (route !== undefined) return { kind: "term", href: `/term/${route[1]}/` };
  const query = new URLSearchParams({ term: input }).toString();
  return { kind: "analyze", href: `/analyze/?term=${query.slice("term=".length)}` };
}
