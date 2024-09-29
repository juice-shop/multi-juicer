import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: '/balancer/',
    build: {
      outDir: 'build',
    },
    plugins: [react()],
    server: {
        proxy: {
            // proxy every request but those that start with /balancer to port 3000
            '^/balancer/.*': "http://localhost:4000",
        },
    }
  };
});
