import { readFileSync, existsSync } from "fs";
import chalk from "chalk";
import { CloudflareProjectConfig } from "./adapter";

/**
 * Verifica si un proyecto ya existe en Cloudflare Pages usando la API
 */
export async function checkProjectExists(
  projectName: string,
  accountId: string,
  apiToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      },
    );
    return response.status === 200;
  } catch (error) {
    console.warn(
      chalk.yellow(
        `\nNo se pudo verificar si ${projectName} existe (puede ser error de red o autenticación).`,
      ),
    );
    return false;
  }
}

/**
 * Parsea un archivo de texto con formato KEY=VALUE
 */
function parseEnvFile(filePath: string): Record<string, string> {
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

/**
 * Ejecuta el llamado a la API de Cloudflare para crear un nuevo proyecto
 * y enlazarlo con GitHub si corresponde.
 */
export async function createCloudflareProject(
  config: CloudflareProjectConfig,
  accountId: string,
  apiToken: string,
  netlifyEnvVars: Record<string, string> = {},
) {
  const payload: any = {
    name: config.projectName,
    production_branch: config.productionBranch || "main",
    build_config: {
      build_command: config.buildCommand || "",
      destination_dir: config.buildOutputDirectory || "",
      root_dir: config.rootDirectory || "",
    },
  };

  // Buscar variables de entorno locales para este proyecto
  const envFilePath = `envs/${config.projectName}.txt`;
  let fileEnvVars: Record<string, string> = {};

  if (existsSync(envFilePath)) {
    try {
      fileEnvVars = parseEnvFile(envFilePath);
    } catch (err: any) {
      console.warn(
        chalk.yellow(
          `\nNo se pudo leer el archivo de env en ${envFilePath}: ${err.message}`,
        ),
      );
    }
  }

  // Combinar variables (las locales sobreescriben a las de Netlify)
  const envVars = { ...netlifyEnvVars, ...fileEnvVars };

  // Log específico de procedencia de variables
  if (Object.keys(envVars).length > 0) {
    console.log(
      chalk.cyan(
        `\n[Env] Variables para ${config.projectName}: ${Object.keys(netlifyEnvVars).length} desde Netlify | ${Object.keys(fileEnvVars).length} locales.`,
      ),
    );
  }

  if (Object.keys(envVars).length > 0) {
    const formattedEnvVars: Record<string, { value: string }> = {};
    for (const [key, value] of Object.entries(envVars)) {
      formattedEnvVars[key] = { value };
    }

    payload.deployment_configs = {
      production: {
        env_vars: formattedEnvVars,
      },
      preview: {
        env_vars: formattedEnvVars,
      },
    };
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
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
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
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${config.projectName}/deployments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
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

  return data;
}
