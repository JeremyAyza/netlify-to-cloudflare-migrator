import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs"
import chalk from "chalk"
import { NormalizedProjectConfig } from "./adapter"

export interface MigrationTask {
  config: NormalizedProjectConfig
  status: "pending" | "success" | "failed"
  error?: string
  url?: string
  netlifyUrl?: string
  netlifyCustomDomain?: string | null
  netlifyDomainAliases?: string[]
  netlifyDefaultDomain?: string
}

const TASKS_PATH = "migration-tasks.json"

/**
 * Carga las tareas guardadas si existen y no están vacías
 */
export function loadExistingTasks(): MigrationTask[] | null {
  if (existsSync(TASKS_PATH)) {
    const fileContent = readFileSync(TASKS_PATH, "utf-8").trim()
    if (fileContent.length > 0) {
      try {
        return JSON.parse(fileContent)
      } catch (err: any) {
        console.warn(
          chalk.yellow(
            `\nArchivo de tareas corrupto o inválido, se ignorará: ${err.message}`,
          ),
        )
      }
    }
  }
  return null
}

/**
 * Guarda el estado actual de las tareas
 */
export function saveTasks(tasks: MigrationTask[]) {
  writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2))
}

/**
 * Archiva las tareas en la carpeta results/ y elimina el archivo temporal
 */
export function archiveTasks(tasks: MigrationTask[]) {
  try {
    const now = new Date()
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const resultsDir = "results"

    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir)
    }

    const archivedLogPath = `${resultsDir}/log_${dateStr}.json`
    writeFileSync(archivedLogPath, JSON.stringify(tasks, null, 2))
    console.log(
      chalk.cyan(`Historial de tareas guardado en: ${archivedLogPath}`),
    )

    if (existsSync(TASKS_PATH)) {
      unlinkSync(TASKS_PATH)
      console.log(
        chalk.gray(
          `Archivo temporal ${TASKS_PATH} eliminado para permitir nuevas ejecuciones limpias.`,
        ),
      )
    }
  } catch (err: any) {
    console.warn(
      chalk.yellow(
        `\nNo se pudo archivar el log o eliminar el archivo temporal: ${err.message}`,
      ),
    )
  }
}
