import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { SessionService } from "./session.service.js";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
