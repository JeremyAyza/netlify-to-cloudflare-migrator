import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import { fetchNetlifySites, disableNetlifyBuild } from './netlify.js';

async function main() {
  const netlifyToken = process.env.NETLIFY_API_TOKEN;
  if (!netlifyToken) {
    console.error(chalk.red("Error: La variable NETLIFY_API_TOKEN debe estar configurada."));
    process.exit(1);
  }

  const projectsFilterPath = path.resolve(process.cwd(), "projects.txt");
  if (!existsSync(projectsFilterPath)) {
    console.error(chalk.red("Error: El archivo projects.txt no existe."));
    process.exit(1);
  }

  const projectsContent = readFileSync(projectsFilterPath, "utf-8");
  const targetNames = projectsContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (targetNames.length === 0) {
    console.log(chalk.yellow("El archivo projects.txt está vacío o no contiene proyectos válidos."));
    process.exit(0);
  }

  console.log(chalk.blue(`Se leyeron ${targetNames.length} proyectos de projects.txt.`));

  const spinner = ora("Consultando sitios en la API de Netlify...").start();
  let sites: any[] = [];
  try {
    sites = await fetchNetlifySites(netlifyToken, targetNames);
    spinner.succeed(chalk.green(`Encontrados ${sites.length} de ${targetNames.length} proyectos en Netlify.`));
  } catch (error: any) {
    spinner.fail("Fallo al consultar la API de Netlify.");
    console.error(chalk.red(error.message));
    process.exit(1);
  }

  if (sites.length === 0) {
    console.log(chalk.yellow("No se encontraron coincidencias en Netlify para los proyectos listados."));
    process.exit(0);
  }

  // Preparamos la carpeta de resultados
  const resultsDir = path.resolve(process.cwd(), "results_disable_builds");
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  const logResults: { projectName: string; siteId: string; status: string; error?: string }[] = [];

  for (const site of sites) {
    const siteSpinner = ora(`Desactivando builds para ${site.name}...`).start();
    try {
      await disableNetlifyBuild(netlifyToken, site.id);
      siteSpinner.succeed(chalk.green(`Builds desactivados para ${site.name} (${site.id}).`));
      logResults.push({ projectName: site.name, siteId: site.id, status: "success" });
    } catch (error: any) {
      siteSpinner.fail(chalk.red(`Error al desactivar builds para ${site.name}: ${error.message}`));
      logResults.push({ projectName: site.name, siteId: site.id, status: "error", error: error.message });
    }
  }

  // Guardamos el log en formato JSON
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFilePath = path.join(resultsDir, `disable-builds-log-${timestamp}.json`);
  writeFileSync(logFilePath, JSON.stringify(logResults, null, 2), "utf-8");
  console.log(chalk.blue(`\nLog de ejecución guardado en: ${logFilePath}`));

  console.log(chalk.green.bold("\n¡Proceso finalizado!"));
}

main().catch((error) => {
  console.error(chalk.red("Error no controlado:", error));
  process.exit(1);
});
