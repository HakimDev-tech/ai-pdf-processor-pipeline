import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from
  }))
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient
}));

import { POST as runWorker } from "@/app/api/worker/route";
import { POST as reprocessDocument } from "@/app/api/documents/[id]/reprocess/route";

describe("processing route security boundaries", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.createClient.mockReset();
  });

  it("rejects worker invocation when CRON_SECRET is not configured", async () => {
    const response = await runWorker(new Request("https://example.test/api/worker", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects an incorrect worker bearer token", async () => {
    process.env.CRON_SECRET = "test-secret-value-that-is-long-enough";
    const response = await runWorker(new Request("https://example.test/api/worker", {
      method: "POST", headers: { authorization: "Bearer wrong-secret" }
    }));
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated owner before creating a reprocessing version", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await reprocessDocument(
      new Request("https://example.test/api/documents/123/reprocess", { method: "POST" }),
      { params: Promise.resolve({ id: "123e4567-e89b-42d3-a456-426614174000" }) }
    );
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects malformed document identifiers before querying Supabase", async () => {
    const response = await reprocessDocument(
      new Request("https://example.test/api/documents/not-a-uuid/reprocess", { method: "POST" }),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    );
    expect(response.status).toBe(400);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
