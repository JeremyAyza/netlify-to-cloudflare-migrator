import { readFileSync, existsSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { netlifyDataSchema } from "./schema";
import { adaptNetlifyToCloudflare } from "./adapter";
import { loadExistingTasks, saveTasks, archiveTasks, MigrationTask } from "./taskManager";
import { fetchNetlifySites, fetchNetlifyEnvVars } from "./netlify";
import { checkProjectExists, createCloudflareProject } from "./cloudflare";

/**
 * Bucle principal de ejecución de la migración
 * @param dataPath Ruta al JSON de entrada (fallback)
 */
export async function runMigration(dataPath: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error(
      chalk.red(
        "Error: Las variables CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN deben estar configuradas.",
      ),
    );
    process.exit(1);
  }

  let tasks: MigrationTask[] = [];
  const existingTasks = loadExistingTasks();

  // 1. Cargar o Generar Tareas
  if (existingTasks) {
    tasks = existingTasks;
    console.log(chalk.green(`✔ Se cargaron ${tasks.length} tareas previas.`));
  } else {
    const spinner = ora("Cargando datos para la migración...").start();
    const netlifyToken = process.env.NETLIFY_API_TOKEN;
    const projectsFilterPath = "projects.txt";
    let sites: any[] = [];

    // Método 1: API de Netlify (Si hay token y archivo de proyectos)
    if (netlifyToken && existsSync(projectsFilterPath)) {
      try {
        spinner.text = "Leyendo nombres de proyectos desde projects.txt...";
        const filterContent = readFileSync(projectsFilterPath, "utf-8");
        const targetNames = filterContent
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

        spinner.text = "Consultando sitios en la API de Netlify...";
        sites = await fetchNetlifySites(netlifyToken, targetNames);
        
        console.log(
          chalk.green(
            `\n[Netlify] Encontrados ${sites.length} de ${targetNames.length} proyectos solicitados.`,
          ),
        );
      } catch (err: any) {
        spinner.fail("Fallo al consultar la API de Netlify.");
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    } 
    // Método 2: Fallback al archivo data.json tradicional
    else {
      try {
        spinner.text = "Leyendo datos desde data.json...";
        const fileContent = readFileSync(dataPath, "utf-8");
        sites = JSON.parse(fileContent);
      } catch (err: any) {
        spinner.fail("Fallo al leer el archivo de datos JSON (data.json).");
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    }

    // Validar los datos obtenidos
    spinner.text = "Validando esquema de datos...";
    const parseResult = netlifyDataSchema.safeParse(sites);

    if (!parseResult.success) {
      spinner.fail(
        "Validación fallida. Los datos no cumplen con el esquema esperado.",
      );
      console.error(
        chalk.red(JSON.stringify(parseResult.error.format(), null, 2)),
      );
      process.exit(1);
    }

    const validatedSites = parseResult.data;
    tasks = validatedSites.map((site) => ({
      config: adaptNetlifyToCloudflare(site),
      status: "pending" as const,
    }));

    saveTasks(tasks);
    spinner.succeed(
      `Validación exitosa. Se han generado ${tasks.length} tareas.`,
    );
  }

  // 2. Ejecución de las Tareas
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    if (task.status === "success") {
      console.log(
        chalk.gray(`Omitiendo: ${task.config.projectName} (Ya migrado)`),
      );
      continue;
    }

    const siteSpinner = ora(`Procesando: ${task.config.projectName}`).start();
    try {
      siteSpinner.text = `Verificando si ${task.config.projectName} ya existe en Cloudflare...`;
      const exists = await checkProjectExists(
        task.config.projectName,
        accountId,
        apiToken,
      );

      if (exists) {
        siteSpinner.warn(
          `El proyecto ${task.config.projectName} ya existe. Omitiendo creación.`,
        );
        task.status = "success";
        task.url = `${task.config.projectName}.pages.dev`;
      } else {
        let netlifyEnvVars: Record<string, string> = {};
        const netlifyToken = process.env.NETLIFY_API_TOKEN;

        // Consultar variables en Netlify si aplica
        if (netlifyToken && task.config.netlifySiteId) {
          siteSpinner.text = `Consultando variables de entorno en Netlify para ${task.config.projectName}...`;
          try {
            netlifyEnvVars = await fetchNetlifyEnvVars(netlifyToken, task.config.netlifySiteId);
            console.log(
              chalk.cyan(
                `\n[Netlify] Cargadas ${Object.keys(netlifyEnvVars).length} variables desde API para ${task.config.projectName}`,
              ),
            );
          } catch (err: any) {
            console.warn(
              chalk.yellow(
                `\nNo se pudieron cargar las variables de Netlify: ${err.message}`,
              ),
            );
          }
        }

        // Crear proyecto en Cloudflare
        siteSpinner.text = `Creando proyecto ${task.config.projectName} en Cloudflare...`;
        await createCloudflareProject(
          task.config,
          accountId,
          apiToken,
          netlifyEnvVars,
        );

        task.status = "success";
        task.url = `${task.config.projectName}.pages.dev`;
        siteSpinner.succeed(
          `Proyecto ${task.config.projectName} migrado con éxito.`,
        );
      }
    } catch (error: any) {
      console.error(error);
      siteSpinner.fail(`Error al migrar ${task.config.projectName}.`);
      task.status = "failed";
      task.error = error.message || String(error);
    }

    // Guardar el estado después de cada proyecto
    saveTasks(tasks);
  }

  // 3. Finalización y Reporte
  console.log("\n" + chalk.green.bold("¡Proceso de Migración Finalizado!"));

  const failedCount = tasks.filter((t) => t.status === "failed").length;
  if (failedCount > 0) {
    console.log(
      chalk.yellow(
        `\nCuidado: ${failedCount} sitio(s) no se pudieron crear. Revisa los logs en la carpeta results/ para más detalles.`,
      ),
    );
  }

  // Archivar resultados y limpiar archivo temporal
  archiveTasks(tasks);
}
