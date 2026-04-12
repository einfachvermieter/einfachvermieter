import { Module } from "@nestjs/common";
import {
  STATEMENT_STORAGE,
  StorageService,
  statementsBaseDir,
  uploadsBaseDir,
} from "./storage.service.js";

@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: () => new StorageService(uploadsBaseDir()),
    },
    {
      provide: STATEMENT_STORAGE,
      useFactory: () => new StorageService(statementsBaseDir()),
    },
  ],
  exports: [StorageService, STATEMENT_STORAGE],
})
export class StorageModule {}
