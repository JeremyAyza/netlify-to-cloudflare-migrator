import chalk from "chalk";
import { MigrationProvider } from "./MigrationProvider";
import { NormalizedProjectConfig } from "../adapter";

export class CloudflareProvider implements MigrationProvider {
  readonly name = "cloudflare";
  
  constructor(private accountId: string, private apiToken: string) {}

  async checkProjectExists(projectName: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${projectName}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        },
      );
      return response.status === 200;
    } catch (error) {
      console.warn(
        chalk.yellow(
          `\nNo se pudo verificar si ${projectName} existe en Cloudflare (puede ser error de red o autenticación).`,
        ),
      );
      return false;
    }
  }

  async createProject(
    config: NormalizedProjectConfig,
    envVars: { production: Record<string, string>; preview: Record<string, string> }
  ): Promise<{ success: boolean; url?: string }> {
    const payload: any = {
      name: config.projectName,
      production_branch: config.productionBranch || "main",
      build_config: {
        build_command: config.buildCommand || "",
        destination_dir: config.buildOutputDirectory || "",
        root_dir: config.rootDirectory || "",
      },
    };

    const hasProductionVars = Object.keys(envVars.production).length > 0;
    const hasPreviewVars = Object.keys(envVars.preview).length > 0;

    if (hasProductionVars || hasPreviewVars) {
      payload.deployment_configs = {
        production: { env_vars: {} },
        preview: { env_vars: {} },
      };

      if (hasProductionVars) {
        for (const [key, value] of Object.entries(envVars.production)) {
          payload.deployment_configs.production.env_vars[key] = { value };
        }
      }

      if (hasPreviewVars) {
        for (const [key, value] of Object.entries(envVars.preview)) {
          payload.deployment_configs.preview.env_vars[key] = { value };
        }
      }
    }

    if (config.repoOwner && config.repoName) {
      payload.source = {
        type: "github",
        config: {
          owner: config.repoOwner,
          repo_name: config.repoName,
          production_branch: config.productionBranch || "main",
          pr_comments_enabled: true,
          deployments_enabled: true,
          production_deployment_enabled: true,
          preview_deployment_setting: "all",
          preview_deployments_enabled: true,
        },
      };
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.errors?.[0]?.message || JSON.stringify(data.errors || data),
      );
    }

    // Disparar el primer deploy mediante un POST directo a deployments
    try {
      // Esperar 5 segundos a que Cloudflare termine de procesar la conexión con GitHub
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const deployResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${config.projectName}/deployments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        },
      );

      const deployData = await deployResponse.json();

      if (deployResponse.ok) {
        console.log(
          chalk.green(
            `\n[Deploy] Primer deploy disparado con éxito para ${config.projectName}`,
          ),
        );
      } else {
        console.warn(
          chalk.yellow(
            `\nNo se pudo disparar el deploy para ${config.projectName}. Respuesta: ${JSON.stringify(deployData)}`,
          ),
        );
      }
    } catch (err: any) {
      console.warn(
        chalk.yellow(
          `\nNo se pudo disparar el primer deploy para ${config.projectName}: ${err.message}`,
        ),
      );
    }

    return { 
      success: true, 
      url: `${config.projectName}.pages.dev` 
    };
  }
}
