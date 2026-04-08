import { MikroORM } from "@mikro-orm/core";
import { createOrmOptions } from "./mikro-orm/config.js";

/**
 * Standalone-ORM-Instanz für Scripts (Seed, Consistency-Checks,
 * Migrationen) außerhalb des NestJS-Lebenszyklus.
 */
export const initOrm = (): Promise<MikroORM> =>
  createOrmOptions().then((options) => MikroORM.init(options));
