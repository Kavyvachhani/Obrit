import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@orbit/core", replacement: path.resolve(__dirname, "../core/src") },
      { find: /^three$/, replacement: path.resolve(__dirname, "../../node_modules/3d-force-graph/node_modules/three") },
    ],
    dedupe: ["three", "react", "react-dom"],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
