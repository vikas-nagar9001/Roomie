import { defineConfig } from "vite";
import type { RenderedChunk } from "rollup";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    assetsDir: "static",
    // Optimize the build
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // Properly chunk and cache assets
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          const extType = name.split(".").at(1);
          if (extType && /png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `static/images/[name]-[hash][extname]`;
          }
          return `static/assets/[name]-[hash][extname]`;
        },
      },
    },
  },
});
