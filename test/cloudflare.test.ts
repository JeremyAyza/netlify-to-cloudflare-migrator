import { describe, it, expect, vi, afterEach } from "vitest";
import { CloudflareProvider } from "../src/providers";
import { listPagesProjects, updatePagesProjectEnv } from "../src/cloudflareApi";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("CloudflareProvider", () => {
  it("creates the project linked to GitHub with env vars, then triggers the first deploy", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true, result: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CloudflareProvider("ACC", "TOKEN");
    const promise = provider.createProject(
      {
        projectName: "my-landing",
        productionBranch: "main",
        buildCommand: "npm run build",
        buildOutputDirectory: "dist",
        rootDirectory: null,
        repoOwner: "my-user",
        repoName: "my-landing",
        netlifySiteId: "site-1",
      },
      { production: { NODE_VERSION: "22" }, preview: {} },
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    const [createUrl, createInit] = fetchMock.mock.calls[0];
    const payload = JSON.parse(createInit.body);
    expect(createUrl).toBe("https://api.cloudflare.com/client/v4/accounts/ACC/pages/projects");
    expect(payload.build_config).toEqual({ build_command: "npm run build", destination_dir: "dist", root_dir: "" });
    expect(payload.deployment_configs.production.env_vars).toEqual({ NODE_VERSION: { value: "22" } });
    expect(payload.source.config).toMatchObject({ owner: "my-user", repo_name: "my-landing", production_branch: "main" });

    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/ACC/pages/projects/my-landing/deployments",
    );
    expect(result).toEqual({ success: true, url: "my-landing.pages.dev" });
  });

  it("reports whether a project already exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({}, 200)).mockResolvedValueOnce(json({}, 404)));
    const provider = new CloudflareProvider("ACC", "TOKEN");

    expect(await provider.checkProjectExists("exists")).toBe(true);
    expect(await provider.checkProjectExists("missing")).toBe(false);
  });
});

describe("cloudflareApi", () => {
  it("lists projects across pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ success: true, result: [{ name: "a" }], result_info: { total_pages: 2 } }))
        .mockResolvedValueOnce(json({ success: true, result: [{ name: "b" }], result_info: { total_pages: 2 } })),
    );

    const projects = await listPagesProjects("ACC", "TOKEN");
    expect(projects.map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("sends only the given variables to the selected environments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true, result: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await updatePagesProjectEnv("ACC", "TOKEN", "my-landing", { API_URL: "https://x.dev" }, ["preview"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/ACC/pages/projects/my-landing");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      deployment_configs: { preview: { env_vars: { API_URL: { value: "https://x.dev" } } } },
    });
  });

  it("surfaces the Cloudflare error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ success: false, errors: [{ message: "Project not found" }] }, 404)),
    );

    await expect(updatePagesProjectEnv("ACC", "TOKEN", "nope", { A: "1" }, ["production"])).rejects.toThrow(
      "Project not found",
    );
  });
});
