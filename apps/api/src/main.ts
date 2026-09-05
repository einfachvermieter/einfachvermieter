import "./load-env.js";
import { createHash, timingSafeEqual } from "node:crypto";
import { MikroORM } from "@mikro-orm/core";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { authMode } from "./auth/auth-mode.js";
import { checkDatabaseVersion } from "./updates/database-version-guard.js";

const bootstrap = async (): Promise<void> => {
  // `local` ist nur mit Loopback-Token sicher: ohne Token wäre jeder Request
  // Admin, auch aus dem Netz, wenn die API nicht an 127.0.0.1 gebunden ist.
  if (authMode() === "local" && !process.env.LOOPBACK_TOKEN) {
    throw new Error("Für AUTH_MODE=local muss LOOPBACK_TOKEN gesetzt sein.");
  }

  const app = await NestFactory.create(AppModule);

  // Produktion provisioniert sich beim Start selbst: Datenbank anlegen (falls
  // nötig) und ausstehende Migrationen anwenden.
  const orm = app.get(MikroORM);
  if (process.env.NODE_ENV === "production") {
    await orm.schema.ensureDatabase();
    await orm.migrator.up();
  }
  await checkDatabaseVersion(orm.em);

  // TRUST_PROXY = Anzahl vertrauenswürdiger Proxy-Hops: `req.ip` (Rate-Limit)
  // und `req.secure` (Secure-Cookie) kommen dann aus X-Forwarded-*. Default 0,
  // sonst könnte jeder Client seine IP per Header setzen.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  if (trustProxy > 0) {
    app.getHttpAdapter().getInstance().set("trust proxy", trustProxy);
  }

  // Default-CSP von Helmet setzt `object-src 'none'`. Im Production-Setup
  // serviert der API das Web-Build via ServeStaticModule. Diese CSP gilt
  // dann auch fürs HTML und würde unser `<object data="/api/.../pdf">` im
  // PDF-Tab blockieren. Same-origin-Objekte explizit erlauben.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "object-src": ["'self'"],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.setGlobalPrefix("api");

  // Desktop-App (Electron): Im `local`-Auth-Modus gibt es keinen Login, also
  // darf kein fremder lokaler Prozess die Loopback-API benutzen. Der
  // Electron-Main-Prozess erzeugt pro Start ein Zufalls-Token, reicht es hier
  // als Env herein und injiziert es in alle Requests des App-Fensters; alles
  // ohne gültiges Token wird abgewiesen (auch die statischen Web-Assets).
  const loopbackToken = process.env.LOOPBACK_TOKEN;
  if (loopbackToken) {
    // Hash-Vergleich statt Klartext: timingSafeEqual verlangt gleiche Längen.
    const expected = createHash("sha256").update(loopbackToken).digest();
    app.use((req: Request, res: Response, next: NextFunction) => {
      const provided = createHash("sha256")
        .update(req.header("x-loopback-token") ?? "")
        .digest();
      if (!timingSafeEqual(expected, provided)) {
        res.status(403).end();
        return;
      }
      next();
    });
  }

  // CORS nur, wenn das Frontend von einem anderen Origin kommt (Dev: Vite auf
  // :7272). In Produktion liefert die API das Web-Build selbst aus, alle
  // Requests sind same-origin, CORS bleibt dann aus.
  const webOrigin = process.env.WEB_ORIGIN;
  if (webOrigin) {
    app.enableCors({ origin: webOrigin, credentials: true });
  }

  // HOST erlaubt der Desktop-App, die API strikt an 127.0.0.1 zu binden;
  // ohne Angabe wie bisher alle Interfaces (Container-Betrieb).
  const port = Number(process.env.PORT ?? 7273);
  await app.listen(port, process.env.HOST || "0.0.0.0");
};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
