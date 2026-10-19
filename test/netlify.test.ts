import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNetlifySites, fetchNetlifyEnvVars } from "../src/netlify";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNetlifySites", () => {
  it("reads every page and keeps only the requested sites", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: `${i}`, name: `site-${i}` }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(firstPage))
      .mockResolvedValueOnce(json([{ id: "100", name: "last-site" }]));
    vi.stubGlobal("fetch", fetchMock);

    const sites = await fetchNetlifySites("token", ["site-3", "last-site"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
    expect(sites.map((s) => s.name)).toEqual(["site-3", "last-site"]);
  });

  it("throws when Netlify answers with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401, statusText: "Unauthorized" })));

    await expect(fetchNetlifySites("bad-token", ["x"])).rejects.toThrow("Unauthorized");
  });
});

describe("fetchNetlifyEnvVars", () => {
  it("splits values by context into production and preview", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json([
          { key: "SHARED", values: [{ context: "all", value: "1" }] },
          { key: "API_URL", values: [{ context: "production", value: "prod" }, { context: "deploy-preview", value: "preview" }] },
          { key: "DEV_ONLY", values: [{ context: "dev", value: "x" }] },
        ]),
      ),
    );

    const env = await fetchNetlifyEnvVars("token", "site-id");

    expect(env.production).toEqual({ SHARED: "1", API_URL: "prod" });
    expect(env.preview).toEqual({ SHARED: "1", API_URL: "preview" });
  });
});
