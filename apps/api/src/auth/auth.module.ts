import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { LocalAdminService } from "./local-admin.service.js";
import { SessionService } from "./session.service.js";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, LocalAdminService],
  exports: [AuthService, SessionService, LocalAdminService],
})
export class AuthModule {}
