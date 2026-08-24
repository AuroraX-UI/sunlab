import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    outDir: process.env.SUNLAB_DIST_DIR ?? resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
