import { z } from "zod";

export const EvidenceSchema = z.object({
  page: z.number().int().positive(),
  excerpt: z.string().min(1).max(500)
});

export const FindingSchema = z.object({
  text: z.string().min(1).max(2000),
  evidence: z.array(EvidenceSchema).max(8).default([]),
  certainty: z.enum(["supported", "uncertain", "interpretation"])
});

export const AnalysisSchema = z.object({
  title: z.string().max(300),
  category: z.string().max(120),
  language: z.string().max(80),
  summary: z.string().min(1).max(6000),
  keyPoints: z.array(FindingSchema).max(30),
  datesAndObligations: z.array(FindingSchema).max(30),
  risksAndAmbiguities: z.array(FindingSchema).max(20),
  recommendations: z.array(z.string().max(1000)).max(15),
  limitations: z.array(z.string().max(1000)).max(15)
});

export type Analysis = z.infer<typeof AnalysisSchema>;