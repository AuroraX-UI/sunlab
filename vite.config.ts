import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const pathResolve = (p: string) => resolve(import.meta.dirname ?? "", p);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": pathResolve("src"),
    },
  },
  build: {
    outDir: process.env.SUNLAB_DIST_DIR ?? resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
