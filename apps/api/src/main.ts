import "./load-env.js";
import { MikroORM } from "@mikro-orm/core";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);

  // Produktion provisioniert sich beim Start selbst: Datenbank anlegen (falls
  // nötig) und ausstehende Migrationen anwenden.
  if (process.env.NODE_ENV === "production") {
    const orm = app.get(MikroORM);
    await orm.schema.ensureDatabase();
    await orm.migrator.up();
  }

  // Hinter dem Caddy-Reverse-Proxy: erste Hop als vertrauenswürdig markieren,
  // damit `req.ip` (und damit das Rate-Limiting) die echte Client-IP aus
  // X-Forwarded-For nutzt statt der Proxy-IP
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

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

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
