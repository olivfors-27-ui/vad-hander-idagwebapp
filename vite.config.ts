import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
      spa: {
        enabled: true,
        prerender: { outputPath: "/index.html" },
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
});
