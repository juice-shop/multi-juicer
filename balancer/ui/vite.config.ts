import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    base: "/balancer/",
    build: {
      outDir: "build",
      sourcemap: true, // we are an open source project, we have nothing to hide :D
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/balancer/api": "http://localhost:8080",
      },
    },
  };
});
