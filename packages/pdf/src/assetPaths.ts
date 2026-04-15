import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const appLogoPath = resolve(here, "..", "assets", "logo-pdf.svg");
