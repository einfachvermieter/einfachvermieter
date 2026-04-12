import { resolve } from "node:path";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
} catch {
  // .env ist optional. Im Deployment kommen die Werte aus dem Environment
}
