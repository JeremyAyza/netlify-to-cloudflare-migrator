import { z } from "zod";

export const netlifySiteSchema = z.object({
  id: z.string().min(1, "El ID del sitio es obligatorio"),
  name: z.string().min(1, "El nombre del proyecto es obligatorio"),
  url: z.string().nullable().optional(),
  custom_domain: z.string().nullable().optional(),
  domain_aliases: z.array(z.string()).nullable().optional(),
  default_domain: z.string().nullable().optional(),
  build_settings: z
    .object({
      repo_path: z.string().nullable().optional(),
      repo_branch: z.string().nullable().optional(),
      cmd: z.string().nullable().optional(),
      dir: z.string().nullable().optional(),
      base: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const netlifyDataSchema = z.array(netlifySiteSchema);

export type NetlifySite = z.infer<typeof netlifySiteSchema>;
