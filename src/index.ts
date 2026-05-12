import 'dotenv/config';
import { runMigration } from './migrator.js';
import * as path from 'path';

// Ejecutamos la migración apuntando al data.json en el directorio actual
const dataFilePath = path.resolve(process.cwd(), 'data.json');

runMigration(dataFilePath).catch((error) => {
  console.error('Error no controlado durante la migración:', error);
  process.exit(1);
});
