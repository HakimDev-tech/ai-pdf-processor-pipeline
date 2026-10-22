import type { Analysis } from "@/lib/analysis/schema";

type Finding = Analysis["keyPoints"][number];

function normalizeEvidenceText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Retain only excerpts that can be found in the referenced extracted page.
 * Whitespace normalization tolerates line wrapping introduced by PDF extraction.
 */
export function validateAnalysisEvidence(analysis: Analysis, pageTexts: string[]): Analysis {
  const validateFindings = (findings: Finding[]): Finding[] => findings.map((finding) => {
    const evidence = finding.evidence.filter((item) => {
      const pageText = pageTexts[item.page - 1];
      if (!pageText) return false;
      const excerpt = normalizeEvidenceText(item.excerpt);
      return excerpt.length > 0 && normalizeEvidenceText(pageText).includes(excerpt);
    });
    return {
      ...finding,
      evidence,
      certainty: evidence.length === 0 && finding.certainty === "supported"
        ? "uncertain"
        : finding.certainty
    };
  });

  return {
    ...analysis,
    keyPoints: validateFindings(analysis.keyPoints),
    datesAndObligations: validateFindings(analysis.datesAndObligations),
    risksAndAmbiguities: validateFindings(analysis.risksAndAmbiguities)
  };
}
