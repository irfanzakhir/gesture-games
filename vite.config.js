import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gesture-games/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'docs'
  },
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision']
  }
});
