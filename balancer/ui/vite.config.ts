import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  return {
    base: "/balancer/",
    build: {
      outDir: "build",
      sourcemap: true, // we are an open source project, we have nothing to hide :D
    },
    plugins: [react()],
    server: {
      proxy: {
        "/balancer/api": "http://localhost:8080",
      },
    },
  };
});
