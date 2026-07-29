import Script from "next/script";

import { enhancerScriptStrategy } from "../lib/enhancer-script";

export function ProgressiveEnhancerScript({ src }: { readonly src: string }) {
  return <Script src={src} strategy={enhancerScriptStrategy(process.env["NODE_ENV"])} type="module" />;
}
