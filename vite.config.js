import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision']
  }
});
