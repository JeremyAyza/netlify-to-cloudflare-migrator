import chalk from "chalk";

/**
 * Consulta la lista de sitios en Netlify y los filtra por los nombres solicitados
 */
export async function fetchNetlifySites(netlifyToken: string, targetNames: string[]): Promise<any[]> {
  const response = await fetch("https://api.netlify.com/api/v1/sites", {
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error en API de Netlify: ${response.statusText}`);
  }

  const allSites = await response.json();
  return allSites.filter((site: any) => targetNames.includes(site.name));
}

/**
 * Consulta las variables de entorno de producción para un sitio específico en Netlify
 */
export async function fetchNetlifyEnvVars(netlifyToken: string, siteId: string): Promise<Record<string, string>> {
  const envResponse = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/env?context_name=production`,
    {
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
      },
    },
  );

  const envVars: Record<string, string> = {};

  if (envResponse.ok) {
    const envData = await envResponse.json();
    for (const item of envData) {
      const prodValue = item.values.find(
        (v: any) => v.context === "production" || v.context === "all",
      );
      if (prodValue) {
        envVars[item.key] = prodValue.value;
      }
    }
  } else {
    throw new Error(`Error al consultar variables: ${envResponse.statusText}`);
  }

  return envVars;
}

/**
 * Desactiva los despliegues (builds) automáticos de un sitio en Netlify
 */
export async function disableNetlifyBuild(netlifyToken: string, siteId: string): Promise<void> {
  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      build_settings: {
        stop_builds: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Error al detener builds en Netlify: ${response.statusText}`);
  }
}
