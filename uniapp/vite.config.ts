import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  plugins: [uni()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/health": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/auth": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/users": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/devices": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/dev": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/plants": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/soil": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/diagnose": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/weather": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/knowledge": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/ingest": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/internal": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/tasks": { target: "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
});
