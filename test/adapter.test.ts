import { describe, it, expect } from "vitest";
import { normalizeNetlifySite } from "../src/adapter";
import { netlifyDataSchema } from "../src/schema";

describe("normalizeNetlifySite", () => {
  it("maps Netlify build settings to the provider config", () => {
    const config = normalizeNetlifySite({
      id: "site-1",
      name: "my-landing",
      build_settings: {
        repo_path: "my-user/my-landing",
        repo_branch: "develop",
        cmd: "npm run build",
        dir: "dist",
        base: "apps/web",
      },
    });

    expect(config).toEqual({
      projectName: "my-landing",
      productionBranch: "develop",
      buildCommand: "npm run build",
      buildOutputDirectory: "dist",
      rootDirectory: "apps/web",
      repoOwner: "my-user",
      repoName: "my-landing",
      netlifySiteId: "site-1",
    });
  });

  it("falls back to main and nulls when build settings are missing", () => {
    const config = normalizeNetlifySite({ id: "site-2", name: "no-repo", build_settings: null });

    expect(config.productionBranch).toBe("main");
    expect(config.buildCommand).toBeNull();
    expect(config.repoOwner).toBeNull();
    expect(config.repoName).toBeNull();
  });

  it("ignores a repo path that is not owner/repo", () => {
    const config = normalizeNetlifySite({
      id: "site-3",
      name: "odd-repo",
      build_settings: { repo_path: "only-one-part" },
    });

    expect(config.repoOwner).toBeNull();
    expect(config.repoName).toBeNull();
  });
});

describe("netlifyDataSchema", () => {
  it("accepts the example input file shape", () => {
    const result = netlifyDataSchema.safeParse([
      { id: "1", name: "site", url: null, custom_domain: null, build_settings: { cmd: "npm run build" } },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects a site without a name", () => {
    const result = netlifyDataSchema.safeParse([{ id: "1", name: "" }]);
    expect(result.success).toBe(false);
  });
});
