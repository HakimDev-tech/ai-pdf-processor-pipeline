import { describe, expect, it } from "vitest";
import { AnalysisSchema } from "@/lib/analysis/schema";
import { validateAnalysisEvidence } from "@/lib/analysis/evidence";

const valid = AnalysisSchema.parse({
  title: "Report", category: "Report", language: "English", summary: "Summary.",
  keyPoints: [
    { text: "Supported", certainty: "supported", evidence: [{ page: 3, excerpt: "Revenue increased by 10%." }] },
    { text: "Unverified", certainty: "supported", evidence: [{ page: 2, excerpt: "Not present." }] }
  ],
  datesAndObligations: [], risksAndAmbiguities: [], recommendations: [], limitations: []
});

describe("validateAnalysisEvidence", () => {
  it("normalizes whitespace while validating the correct page", () => {
    const result = validateAnalysisEvidence(valid, [
      "Page one text",
      "",
      "Revenue increased\nby 10%."
    ]);
    expect(result.keyPoints[0].evidence).toHaveLength(1);
    expect(result.keyPoints[0].certainty).toBe("supported");
  });

  it("removes unsupported excerpts and downgrades unsupported certainty", () => {
    const result = validateAnalysisEvidence(valid, [
      "Page one text",
      "Page two text",
      "Page three text without the claim"
    ]);
    expect(result.keyPoints[1].evidence).toHaveLength(0);
    expect(result.keyPoints[1].certainty).toBe("uncertain");
  });

  it("does not shift evidence page numbers when an extracted page is empty", () => {
    const result = validateAnalysisEvidence(valid, ["Page one", "", "Revenue increased by 10%."]);
    expect(result.keyPoints[0].evidence[0].page).toBe(3);
  });
});
