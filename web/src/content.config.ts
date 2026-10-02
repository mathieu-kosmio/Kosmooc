import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const modules = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/modules' }),
  schema: z.object({
    id: z.string().regex(/^m\d+$/),
    ordre: z.number().int(),
    titre: z.string(),
    duree: z.number().int(),
    resume: z.string(),
    objectifs: z.array(z.string()).min(1),
    competences: z.array(z.string()).default([]),
    statut: z.enum(['pret', 'trame']),
    videos: z.array(z.object({
      titre: z.string(),
      duree: z.string(),
      src: z.string().default(''),
      script: z.string().optional(),
    })).default([]),
    ressources: z.array(z.object({
      titre: z.string(),
      type: z.enum(['fiche', 'fichier']),
      ref: z.string(),
    })).default([]),
    quiz: z.boolean().default(false),
    exercice: z.boolean().default(false),
  }),
});

const fiches = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/fiches' }),
  schema: z.object({ titre: z.string(), module: z.string() }),
});

export const collections = { modules, fiches };
