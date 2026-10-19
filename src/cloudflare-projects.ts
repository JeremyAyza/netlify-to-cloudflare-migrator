import 'dotenv/config';
import chalk from 'chalk';
import {
  listPagesProjects,
  getPagesProject,
  updatePagesProjectEnv,
  parseKeyValueArgs,
  EnvTarget,
} from './cloudflareApi.js';

const USAGE = `Uso:
  npm run cf -- list
  npm run cf -- get <proyecto>
  npm run cf -- set-env <proyecto> KEY=VALUE [KEY=VALUE ...] [--preview | --all]`;

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    console.error(chalk.red("Error: Las variables CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN deben estar configuradas."));
    process.exit(1);
  }

  const [command, ...args] = process.argv.slice(2);

  if (command === "list") {
    const projects = await listPagesProjects(accountId, apiToken);
    console.log(chalk.blue(`${projects.length} proyecto(s) en Cloudflare Pages:\n`));
    for (const project of projects) {
      const status = project.latest_deployment?.latest_stage?.status ?? "sin deploys";
      const repo = project.source?.config
        ? `${project.source.config.owner}/${project.source.config.repo_name}`
        : "sin repo";
      console.log(`${project.name}  ${chalk.gray(repo)}  rama: ${project.production_branch}  último deploy: ${status}`);
    }
    return;
  }

  if (command === "get" && args[0]) {
    const project = await getPagesProject(accountId, apiToken, args[0]);
    const envNames = (target: EnvTarget) =>
      Object.keys(project.deployment_configs?.[target]?.env_vars || {}).join(", ") || "(ninguna)";

    console.log(chalk.bold(project.name));
    console.log(`  Dominio:          ${project.subdomain}`);
    console.log(`  Rama producción:  ${project.production_branch}`);
    console.log(`  Build:            ${project.build_config?.build_command || "(vacío)"}`);
    console.log(`  Carpeta salida:   ${project.build_config?.destination_dir || "(vacío)"}`);
    console.log(`  Directorio raíz:  ${project.build_config?.root_dir || "(vacío)"}`);
    console.log(`  Variables prod:   ${envNames("production")}`);
    console.log(`  Variables prev:   ${envNames("preview")}`);
    return;
  }

  if (command === "set-env" && args[0]) {
    const [projectName, ...rest] = args;
    const flags = rest.filter((arg) => arg.startsWith("--"));
    const pairs = rest.filter((arg) => !arg.startsWith("--"));
    if (pairs.length === 0) {
      console.error(chalk.red("Error: Indica al menos una variable KEY=VALUE.\n"));
      console.log(USAGE);
      process.exit(1);
    }

    const targets: EnvTarget[] = flags.includes("--all")
      ? ["production", "preview"]
      : flags.includes("--preview")
        ? ["preview"]
        : ["production"];

    const vars = parseKeyValueArgs(pairs);
    await updatePagesProjectEnv(accountId, apiToken, projectName, vars, targets);
    console.log(
      chalk.green(`Variables actualizadas en ${projectName} (${targets.join(", ")}): ${Object.keys(vars).join(", ")}`),
    );
    console.log(chalk.gray("Los cambios se aplican en el próximo deploy."));
    return;
  }

  console.log(USAGE);
  process.exit(command ? 1 : 0);
}

main().catch((error) => {
  console.error(chalk.red("Error:", error.message || error));
  process.exit(1);
});
