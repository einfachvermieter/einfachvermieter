import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Dev-only: erzwingt einen Full-Reload, sobald sich die kompilierte Locale des
 * i18n-Pakets ändert. `tsc --watch` (turbo dev) schreibt `dist/locales/de.json`
 * nach jeder Änderung an der Quell-`de.json` neu; wir beobachten genau diese
 * Datei.
 *
 * Ein Full-Reload (kein partielles HMR) ist nötig, weil die i18next-Instanz nur
 * einmal beim Modul-Load initialisiert wird (src/lib/i18n.ts -> createI18nSync)
 * und die Strings dabei in den Speicher kopiert werden. Damit der Reload die
 * frischen Strings lädt, ist das i18n-Paket zusätzlich vom Dep-Pre-Bundling
 * ausgenommen (sonst serviert Vite den veralteten Bundle-Cache).
 */
const i18nHotReload = (): Plugin => {
  const localeFile = resolve(
    import.meta.dirname,
    "../../packages/i18n/dist/locales/de.json",
  );
  return {
    name: "i18n-hot-reload",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(localeFile);
      server.watcher.on("change", (file) => {
        if (file === localeFile) {
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(import.meta.dirname, "../.."), "");
  const webPort = Number(env.WEB_PORT ?? 5173);
  const apiPort = Number(env.PORT ?? 3000);

  return {
    plugins: [react(), i18nHotReload()],
    // i18n-Paket nicht pre-bundlen, damit Vite die live aktualisierte dist
    // serviert (siehe i18nHotReload).
    optimizeDeps: {
      exclude: ["@einfachvermieter/i18n"],
    },
    server: {
      host: "0.0.0.0",
      port: webPort,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
