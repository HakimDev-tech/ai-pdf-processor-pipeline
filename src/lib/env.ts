import { z } from "zod";

const optionalNonEmpty = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmpty,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmpty,
  GEMINI_API_KEY: optionalNonEmpty,
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  MAX_PDF_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  MAX_EXTRACTED_CHARS: z.coerce.number().int().positive().default(120_000)
});

export const env = envSchema.parse(process.env);
export function hasSupabaseConfig() {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}