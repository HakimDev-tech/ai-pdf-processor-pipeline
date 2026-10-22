import { describe, expect, it } from "vitest";
import { AnalysisSchema } from "@/lib/analysis/schema";

const valid = {
  title: "Quarterly report", category: "Report", language: "English", summary: "A short summary.",
  keyPoints: [{ text: "Revenue increased.", certainty: "supported", evidence: [{ page: 1, excerpt: "Revenue increased." }] }],
  datesAndObligations: [], risksAndAmbiguities: [], recommendations: [], limitations: []
};

describe("AnalysisSchema", () => {
  it("accepts structured results with evidence", () => {
    expect(AnalysisSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects invalid evidence page numbers", () => {
    const value = structuredClone(valid);
    value.keyPoints[0].evidence[0].page = 0;
    expect(AnalysisSchema.safeParse(value).success).toBe(false);
  });
  it("rejects missing required summary", () => {
    const value = { ...valid, summary: "" };
    expect(AnalysisSchema.safeParse(value).success).toBe(false);
  });
});