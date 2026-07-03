import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Standalone marketing site. Intentionally isolated from the AForce-Command
// pnpm workspace (own package.json, own node_modules) so the fragile monorepo
// install is never touched.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 4321, open: false },
});
