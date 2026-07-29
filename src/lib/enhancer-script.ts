export function enhancerScriptStrategy(environment: string | undefined): "lazyOnload" | "afterInteractive" {
  return environment === "development" ? "lazyOnload" : "afterInteractive";
}
