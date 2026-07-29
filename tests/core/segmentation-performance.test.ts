import { describe, expect, it, vi } from "vitest";

import { segmentTerm } from "../../src/core/segmentation";
import { corpus } from "../../src/generated/corpus";

describe("segmentation allocation budget", () => {
  it("Given repeated partial analyses, when segmentation runs, then immutable corpus surfaces are not reprojected", () => {
    const projection = vi.spyOn(corpus.parts, "flatMap");

    segmentTerm("hypoxnephritis");
    segmentTerm("hypoxnephritis");

    expect(projection).not.toHaveBeenCalled();
    projection.mockRestore();
  });

  it("Given a partial analysis, when candidate paths are ranked, then offsets do not allocate a recursive memo map", () => {
    const memoWrites = vi.spyOn(Map.prototype, "set");

    segmentTerm("hypoxnephritis");

    expect(memoWrites).not.toHaveBeenCalled();
    memoWrites.mockRestore();
  });
});
