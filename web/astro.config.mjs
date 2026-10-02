// @ts-check
import { defineConfig } from 'astro/config';

// Le site est construit en statique dans backend/pb_public : PocketBase sert
// le front et l'API sur la même origine (un seul conteneur).
export default defineConfig({
  output: 'static',
  outDir: '../backend/pb_public',
  trailingSlash: 'always',
  build: { format: 'directory' },
  site: process.env.ACADEMIE_URL || 'http://localhost:8090',
});
