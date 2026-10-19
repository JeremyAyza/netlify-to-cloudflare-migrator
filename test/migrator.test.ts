import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runMigration } from "../src/migrator";
import { MigrationProvider } from "../src/providers";
import { NormalizedProjectConfig } from "../src/adapter";

const site = (name: string) => ({
  id: `id-${name}`,
  name,
  build_settings: { repo_path: `my-user/${name}`, repo_branch: "main", cmd: "npm run build", dir: "dist" },
});

class FakeProvider implements MigrationProvider {
  readonly name = "fake";
  created: { config: NormalizedProjectConfig; envVars: any }[] = [];

  constructor(
    private existing: string[] = [],
    private failing: string[] = [],
  ) {}

  async checkProjectExists(projectName: string) {
    return this.existing.includes(projectName);
  }

  async createProject(config: NormalizedProjectConfig, envVars: any) {
    if (this.failing.includes(config.projectName)) throw new Error("API down");
    this.created.push({ config, envVars });
    return { success: true, url: `${config.projectName}.example.dev` };
  }
}

const originalCwd = process.cwd();
const originalToken = process.env.NETLIFY_API_TOKEN;

beforeEach(() => {
  process.chdir(mkdtempSync(join(tmpdir(), "migration-")));
  delete process.env.NETLIFY_API_TOKEN;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalToken !== undefined) process.env.NETLIFY_API_TOKEN = originalToken;
  vi.restoreAllMocks();
});

describe("runMigration (data.json mode)", () => {
  it("creates missing projects, skips existing ones and archives the run", async () => {
    writeFileSync("data.json", JSON.stringify([site("new-site"), site("already-there")]));
    mkdirSync("envs");
    writeFileSync("envs/new-site.txt", "NODE_VERSION=22\n");
    const provider = new FakeProvider(["already-there"]);

    await runMigration("data.json", provider);

    expect(provider.created.map((c) => c.config.projectName)).toEqual(["new-site"]);
    expect(provider.created[0].envVars.production).toEqual({ NODE_VERSION: "22" });

    expect(existsSync("migration-tasks.json")).toBe(false);
    const [log] = readdirSync("results");
    const tasks = JSON.parse(readFileSync(join("results", log), "utf-8"));
    expect(tasks.map((t: any) => t.status)).toEqual(["success", "success"]);
  });

  it("marks a failing site and keeps going with the rest", async () => {
    writeFileSync("data.json", JSON.stringify([site("broken"), site("fine")]));
    const provider = new FakeProvider([], ["broken"]);

    await runMigration("data.json", provider);

    const [log] = readdirSync("results");
    const tasks = JSON.parse(readFileSync(join("results", log), "utf-8"));
    expect(tasks.map((t: any) => [t.config.projectName, t.status, t.error])).toEqual([
      ["broken", "failed", "API down"],
      ["fine", "success", undefined],
    ]);
  });

  it("resumes from migration-tasks.json and skips finished sites", async () => {
    writeFileSync(
      "migration-tasks.json",
      JSON.stringify([
        { config: { projectName: "done" }, status: "success" },
        { config: { projectName: "pending-site", productionBranch: "main" }, status: "pending" },
      ]),
    );
    const provider = new FakeProvider();

    await runMigration("data.json", provider);

    expect(provider.created.map((c) => c.config.projectName)).toEqual(["pending-site"]);
  });
});
