import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './application/services/auth.service';
import { HashingService } from './application/services/hashing.service';
import { TokenService } from './application/services/token.service';
import { AuthController } from './presentation/http/auth.controller';

@Module({
  imports: [
    JwtModule.register({
      global: false,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, HashingService, TokenService],
  exports: [AuthService, HashingService, TokenService],
})
export class AuthModule {}
