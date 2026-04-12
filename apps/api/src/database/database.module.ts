import { createOrmOptions } from "@einfachvermieter/db";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";

/**
 * Bindet MikroORM in NestJS ein. Der Dialekt (libsql/Postgres/MariaDB)
 * wird in `createOrmOptions` aus der Umgebung bestimmt.
 */
@Module({
  imports: [
    MikroOrmModule.forRootAsync({ useFactory: () => createOrmOptions() }),
  ],
})
export class DatabaseModule {}
