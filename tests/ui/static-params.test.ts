import { describe, expect, it } from "vitest";

import { generateStaticParams as generatePartParams } from "../../src/app/parts/[slug]/page";
import { generateStaticParams as generateTermParams } from "../../src/app/term/[slug]/page";
import { corpus } from "../../src/generated/corpus";
import { routeSlugs } from "../../src/generated/routes";
import { partSlug } from "../../src/lib/catalog";

describe("static route parameters", () => {
  it("Given generated term routes, when params are generated, then every term slug is exported once", () => {
    expect(generateTermParams()).toEqual(routeSlugs.map((slug) => ({ slug })));
  });

  it("Given generated parts, when params are generated, then every part slug is exported once", () => {
    expect(generatePartParams()).toEqual(corpus.parts.map((part) => ({ slug: partSlug(part) })));
  });
});
