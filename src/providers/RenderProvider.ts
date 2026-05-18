import chalk from "chalk";
import { MigrationProvider } from "./MigrationProvider";
import { NormalizedProjectConfig } from "../adapter";

export class RenderProvider implements MigrationProvider {
  readonly name = "render";
  
  constructor(private apiToken: string, private ownerId?: string) {}

  async checkProjectExists(projectName: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.render.com/v1/services?name=${projectName}&type=static_site`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            Accept: "application/json",
          },
        },
      );
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return Array.isArray(data) && data.length > 0;
    } catch (error) {
      console.warn(
        chalk.yellow(
          `\nNo se pudo verificar si ${projectName} existe en Render (puede ser error de red o autenticación).`,
        ),
      );
      return false;
    }
  }

  async createProject(
    config: NormalizedProjectConfig,
    envVars: Record<string, string>
  ): Promise<{ success: boolean; url?: string }> {
    if (!config.repoOwner || !config.repoName) {
      throw new Error(`Para migrar a Render es necesario que el proyecto tenga un repositorio configurado.`);
    }

    // Auto-detectar ownerId si no está provisto o si es un User ID (usr-) incorrecto
    if (!this.ownerId || this.ownerId.startsWith("usr-")) {
      if (this.ownerId?.startsWith("usr-")) {
        console.warn(
          chalk.yellow(`\n[Render] Advertencia: '${this.ownerId}' es un User ID (usr-). Se requiere un Workspace Owner ID (own- o tea-). Intentando auto-detectar...`),
        );
        this.ownerId = undefined;
      }

      try {
        const ownersResponse = await fetch("https://api.render.com/v1/owners", {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            Accept: "application/json",
          },
        });
        if (ownersResponse.ok) {
          const ownersData = await ownersResponse.json();
          if (Array.isArray(ownersData) && ownersData.length > 0 && ownersData[0].owner?.id) {
            this.ownerId = ownersData[0].owner.id;
            console.log(
              chalk.cyan(`\n[Render] OwnerId auto-detectado (Workspace): ${this.ownerId} (${ownersData[0].owner.name})`),
            );
          }
        }
      } catch (err: any) {
        console.warn(chalk.yellow(`\nNo se pudo auto-detectar el ownerId: ${err.message}`));
      }
    }

    if (!this.ownerId) {
      throw new Error(`ownerId is a required field. Por favor configura RENDER_OWNER_ID en tu archivo .env`);
    }

    const payload: any = {
      type: "static_site",
      name: config.projectName,
      ownerId: this.ownerId,
      repo: `https://github.com/${config.repoOwner}/${config.repoName}`,
      branch: config.productionBranch || "main",
      autoDeploy: "yes",
      serviceDetails: {
        buildCommand: config.buildCommand || "",
        publishPath: config.buildOutputDirectory || "",
        pullRequestPreviewsEnabled: "yes",
      },
    };

    if (Object.keys(envVars).length > 0) {
      payload.envVars = Object.entries(envVars).map(([key, value]) => ({
        key,
        value,
      }));
    }

    const response = await fetch("https://api.render.com/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || JSON.stringify(data),
      );
    }
    
    console.log(
      chalk.green(
        `\n[Deploy] Proyecto creado y deploy inicializado con éxito en Render para ${config.projectName}`,
      ),
    );

    return { 
      success: true, 
      url: data.service?.url || `${config.projectName}.onrender.com` 
    };
  }
}
