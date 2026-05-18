import { NetlifySite } from "./schema";

export interface NormalizedProjectConfig {
  projectName: string;
  productionBranch: string;
  buildCommand: string | null;
  buildOutputDirectory: string | null;
  rootDirectory: string | null;
  repoOwner: string | null;
  repoName: string | null;
  netlifySiteId: string | null;
}

export function normalizeNetlifySite(
  site: NetlifySite,
): NormalizedProjectConfig {
  let repoOwner: string | null = null;
  let repoName: string | null = null;

  if (site.build_settings?.repo_path) {
    const parts = site.build_settings.repo_path.split("/");
    if (parts.length === 2) {
      repoOwner = parts[0];
      repoName = parts[1];
    }
  }

  return {
    projectName: site.name,
    productionBranch: site.build_settings?.repo_branch || "main",
    buildCommand: site.build_settings?.cmd || null,
    buildOutputDirectory: site.build_settings?.dir || null,
    rootDirectory: site.build_settings?.base || null,
    repoOwner,
    repoName,
    netlifySiteId: site.id || null,
  };
}
