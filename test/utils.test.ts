import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parseEnvFile } from "../src/utils";
import { parseKeyValueArgs } from "../src/cloudflareApi";

describe("parseEnvFile", () => {
  it("reads KEY=VALUE lines, skips comments and keeps = inside values", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-"));
    const file = join(dir, "site.txt");
    writeFileSync(file, "# comment\nNODE_VERSION=22\n\nAPI_URL=https://api.example.com/?a=1\nBROKEN_LINE\n");

    expect(parseEnvFile(file)).toEqual({
      NODE_VERSION: "22",
      API_URL: "https://api.example.com/?a=1",
    });
  });

  it("returns an empty object when the file does not exist", () => {
    expect(parseEnvFile(join(tmpdir(), "does-not-exist.txt"))).toEqual({});
  });
});

describe("parseKeyValueArgs", () => {
  it("splits only on the first =", () => {
    expect(parseKeyValueArgs(["A=1", "URL=https://x.dev/?q=2"])).toEqual({ A: "1", URL: "https://x.dev/?q=2" });
  });

  it("throws on arguments without a key", () => {
    expect(() => parseKeyValueArgs(["=value"])).toThrow();
    expect(() => parseKeyValueArgs(["NO_EQUALS"])).toThrow();
  });
});
