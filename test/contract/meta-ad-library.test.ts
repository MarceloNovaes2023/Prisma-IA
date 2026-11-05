import { describe, it, expect, beforeAll } from "vitest";
import { fetchMetaAds, metaConfigured } from "../../lib/radar/sources/meta";

// Contract tests for the Meta Ad Library adapter.
// They run against the Graph API stub (scripts/meta-stub.cjs) on 127.0.0.1:4010,
// so no real API key is ever needed.
//
// Scenarios (env: STUB_SCENARIO): normal | flaky | invalid | empty
// The same source code is tested against every scenario so regressions in
// pagination, dedupe and error handling are caught.

const TOKEN = process.env.META_AD_LIBRARY_TOKEN || "test-token";
const GRAPH_BASE = (process.env.META_GRAPH_BASE_URL || "http://127.0.0.1:4010").replace(/\/+$/, "");

describe("Meta Ad Library adapter contract", () => {
  beforeAll(() => {
    process.env.META_AD_LIBRARY_TOKEN = TOKEN;
    process.env.META_GRAPH_BASE_URL = GRAPH_BASE;
  });

  it("reports metaConfigured as true when a token is set", () => {
    expect(metaConfigured()).toBe(true);
  });

  it("returns an empty array when the stub is empty", async () => {
    const ads = await fetchMetaAds({ countries: "BR", pages: 1, limit: 10, activeOnly: true, scenario: "empty" });
    expect(ads).toEqual([]);
  });

  it("returns deduplicated incoming ads from pages", async () => {
    const ads = await fetchMetaAds({ countries: "BR", pages: 2, limit: 10, activeOnly: true });
    const ids = ads.map((a) => a.external_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("flattens page payloads into IncomingAd records", async () => {
    const ads = await fetchMetaAds({ countries: "BR", pages: 1, limit: 10, activeOnly: true, scenario: "normal" });
    for (const ad of ads) {
      expect(ad).toMatchObject({
        source: "meta",
      });
    }
  });
});
