import 'dotenv/config';
import { runMigration } from './migrator.js';
import * as path from 'path';
import { CloudflareProvider, RenderProvider } from './providers';
import chalk from 'chalk';

// Configuración del proveedor destino (por defecto Cloudflare)
const TARGET_PROVIDER = process.env.TARGET_PROVIDER || 'cloudflare';

let provider;
if (TARGET_PROVIDER === 'render') {
  const renderToken = process.env.RENDER_API_TOKEN;
  const renderOwnerId = process.env.RENDER_OWNER_ID;
  if (!renderToken) {
    console.error(chalk.red("Error: La variable RENDER_API_TOKEN debe estar configurada para migrar a Render."));
    process.exit(1);
  }
  provider = new RenderProvider(renderToken, renderOwnerId);
} else {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    console.error(chalk.red("Error: Las variables CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN deben estar configuradas para migrar a Cloudflare."));
    process.exit(1);
  }
  provider = new CloudflareProvider(accountId, apiToken);
}

// Ejecutamos la migración apuntando al data.json en el directorio actual
const dataFilePath = path.resolve(process.cwd(), 'data.json');

runMigration(dataFilePath, provider).catch((error) => {
  console.error('Error no controlado durante la migración:', error);
  process.exit(1);
});
