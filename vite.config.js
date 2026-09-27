import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gesture-games/',
  root: '.',
  publicDir: 'public',
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision']
  }
});
