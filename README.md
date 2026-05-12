# Netlify to Cloudflare Pages Migrator

Un script automatizado para migrar configuraciones de proyectos desde Netlify hacia Cloudflare Pages utilizando la API REST de Cloudflare y la API de Netlify.

## Características

- **Migración Completa vía API**: El script no solo crea el proyecto en Cloudflare, sino que lo enlaza automáticamente a su repositorio de GitHub y le configura los comandos de construcción (`build command`), carpeta de salida (`output directory`) y directorio raíz (`root directory`) extraídos de Netlify.
- **Doble Método de Entrada**:
  - **API de Netlify (Recomendado)**: Simplemente pon los nombres de los proyectos en `projects.txt` y el script traerá toda la configuración y variables de entorno directo desde Netlify.
  - **Archivo Local**: Puedes seguir usando un archivo `data.json` con la data estructurada de Netlify.
- **Inyección de Variables de Entorno**: 
  - Las jala automáticamente desde Netlify (entorno de producción).
  - Permite sobreescribir o agregar variables locales usando archivos en la carpeta `envs/[nombre-proyecto].txt`.
- **Disparo de Primer Deploy Automático**: Dado que Cloudflare no dispara el primer build automáticamente al crear proyectos vía API, el script hace una petición POST directa al endpoint de deployments para forzar el primer despliegue.
- **Gestión de Estado Inteligente**: 
  - Mientras el script corre, usa `migration-tasks.json` para recordar por dónde iba. Si se interrumpe, puedes reanudarlo.
  - Al finalizar con éxito, guarda el historial en la carpeta `results/` con la fecha y hora (`log_YYYY-MM-DD_HH-mm-ss.json`) y **elimina** el archivo temporal para que la próxima ejecución empiece limpia.

## Estructura del Proyecto

```text
netlify-to-cloudflare-migrator/
├── envs/                     # Variables de entorno locales (opcional)
├── results/                  # Historial de migraciones finalizadas
├── projects.txt              # Lista de proyectos a migrar (para modo API)
├── data.json                 # Data de respaldo (para modo local)
├── src/                      # Código fuente
│   ├── index.ts              # Punto de entrada
│   ├── migrator.ts           # Orquestador
│   ├── taskManager.ts        # Gestor de estado
│   ├── cloudflare.ts         # Servicio de Cloudflare
│   ├── netlify.ts            # Servicio de Netlify
│   ├── adapter.ts            # Adaptador de datos
│   └── schema.ts             # Validación de esquemas
├── .env                      # Credenciales
└── package.json
```

## Requisitos

- Node.js >= 18.
- **App de Cloudflare en GitHub**: Es necesario que tu cuenta u organización de GitHub tenga autorizada e instalada la aplicación de Cloudflare Pages para que el enlace automático de repositorios funcione.

## Instalación

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Crea tu archivo `.env` (puedes guiarte de `.env.example`):
   ```env
   CLOUDFLARE_ACCOUNT_ID=tu_id
   CLOUDFLARE_API_TOKEN=tu_token
   NETLIFY_API_TOKEN=tu_token_de_netlify (Opcional, para modo API)
   ```

## Guía Práctica: Cómo agregar y migrar un proyecto nuevo

### Opción A: Usando la API de Netlify (Más fácil)
1. Agrega tu `NETLIFY_API_TOKEN` en el `.env`.
2. Crea un archivo `projects.txt` en la raíz y escribe los nombres de los proyectos que quieres migrar (uno por línea). Ejemplo:
   ```text
   mi-proyecto-1
   mi-proyecto-2
   ```
3. Ejecuta la migración:
   ```bash
   npm start
   ```

### Opción B: Usando `data.json` (Manual)
1. Si no pones token de Netlify o no creas `projects.txt`, el script buscará el archivo `data.json` en la raíz.
2. Asegúrate de que tenga la estructura que arroja la API de Netlify.
3. Ejecuta `npm start`.

### (Opcional) Sobreescribir Variables de Entorno
Si quieres forzar variables locales o el proyecto no las tenía en Netlify:
1. Crea un archivo en `envs/[nombre-del-proyecto].txt`.
2. Escribe tus variables en formato `KEY=VALUE`. Ejemplo:
   ```text
   NODE_VERSION=22
   VITE_API_URL=https://api.ejemplo.com
   ```
   *El script las sumará a las que ya traiga de Netlify (las locales tienen prioridad).*
