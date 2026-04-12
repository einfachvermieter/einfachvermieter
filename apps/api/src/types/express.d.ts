import type { AuthUser } from "../auth/auth.service.js";

/**
 * Hängt die vom SessionAuthGuard aufgelöste Identität an den Express-Request
 */
declare global {
  // biome-ignore lint/style/noNamespace: Express-Request-Augmentation erfordert namespace
  namespace Express {
    // biome-ignore lint/style/useConsistentTypeDefinitions: Declaration Merging (Request-Augmentation) erfordert interface
    interface Request {
      user?: AuthUser;
    }
  }
}
