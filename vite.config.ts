import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// `base` : chemin de publication. « / » pour un sous-domaine (diagnostic.lophius.be),
// « /diagnostic/ » si l'app est servie sous un chemin de lophius.be (variable VITE_BASE_PATH).
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [preact()],
  build: { target: 'es2020', sourcemap: false },
});
