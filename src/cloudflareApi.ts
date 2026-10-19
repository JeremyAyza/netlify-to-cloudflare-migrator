/**
 * Llamadas a la API de Cloudflare Pages para consultar y actualizar proyectos ya creados
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

export type EnvTarget = "production" | "preview";

async function cloudflareRequest(apiToken: string, url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.errors?.[0]?.message || `Error en API de Cloudflare: ${response.status}`);
  }

  return data;
}

/**
 * Lista todos los proyectos de Pages de la cuenta (recorre todas las páginas)
 */
export async function listPagesProjects(accountId: string, apiToken: string): Promise<any[]> {
  const projects: any[] = [];

  for (let page = 1; ; page++) {
    const data = await cloudflareRequest(
      apiToken,
      `${API_BASE}/accounts/${accountId}/pages/projects?page=${page}`,
    );
    projects.push(...(data.result || []));

    const totalPages = data.result_info?.total_pages ?? 1;
    if (page >= totalPages) break;
  }

  return projects;
}

/**
 * Obtiene un proyecto de Pages por nombre
 */
export async function getPagesProject(accountId: string, apiToken: string, projectName: string): Promise<any> {
  const data = await cloudflareRequest(
    apiToken,
    `${API_BASE}/accounts/${accountId}/pages/projects/${projectName}`,
  );
  return data.result;
}

/**
 * Agrega o actualiza variables de entorno de un proyecto de Pages.
 * Las variables que no se envían se mantienen como están.
 */
export async function updatePagesProjectEnv(
  accountId: string,
  apiToken: string,
  projectName: string,
  vars: Record<string, string>,
  targets: EnvTarget[],
): Promise<any> {
  const envVars: Record<string, { value: string }> = {};
  for (const [key, value] of Object.entries(vars)) {
    envVars[key] = { value };
  }

  const deploymentConfigs: Record<string, { env_vars: typeof envVars }> = {};
  for (const target of targets) {
    deploymentConfigs[target] = { env_vars: envVars };
  }

  const data = await cloudflareRequest(
    apiToken,
    `${API_BASE}/accounts/${accountId}/pages/projects/${projectName}`,
    {
      method: "PATCH",
      body: JSON.stringify({ deployment_configs: deploymentConfigs }),
    },
  );
  return data.result;
}

/**
 * Convierte argumentos KEY=VALUE en un objeto
 */
export function parseKeyValueArgs(args: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const arg of args) {
    const separator = arg.indexOf("=");
    if (separator <= 0) {
      throw new Error(`Argumento inválido "${arg}". Usa el formato KEY=VALUE.`);
    }
    vars[arg.slice(0, separator).trim()] = arg.slice(separator + 1);
  }
  return vars;
}
