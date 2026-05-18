import { NormalizedProjectConfig } from "../adapter";

export interface MigrationProvider {
  /**
   * Nombre del proveedor (ej. "cloudflare", "render")
   */
  readonly name: string;

  /**
   * Verifica si el proyecto ya existe en el proveedor destino.
   */
  checkProjectExists(projectName: string): Promise<boolean>;

  /**
   * Crea el proyecto en el proveedor destino y lanza el primer deploy si aplica.
   * @returns Un objeto con la información de la creación y la url resultante si está disponible.
   */
  createProject(
    config: NormalizedProjectConfig,
    envVars: Record<string, string>
  ): Promise<{ success: boolean; url?: string }>;
}
