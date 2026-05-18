import { readFileSync, existsSync } from "fs";

/**
 * Parsea un archivo de texto con formato KEY=VALUE
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }
  const content = readFileSync(filePath, "utf-8");
  const env: Record<string, string> = {};
  content.split("\n").forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        env[key] = value;
      }
    }
  });
  return env;
}
