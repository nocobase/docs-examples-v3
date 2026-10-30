import { z } from 'zod';
export const createProject = z.strictObject({
  name: z.string().trim().min(1).max(120),
});
export const listProjects = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export const projectRow = createProject.extend({
  id: z.string(),
  createdAt: z.coerce.date(),
});
export const projectSchema = createProject.extend({
  id: z.string(),
  createdAt: z.iso.datetime(),
});
export type ProjectRow = z.infer<typeof projectRow>;
