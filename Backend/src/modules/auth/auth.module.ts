import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './application/services/auth.service';
import { HashingService } from './application/services/hashing.service';
import { TokenService } from './application/services/token.service';
import { PinThrottlerService } from './application/services/pin-throttler.service';
import { AuthController } from './presentation/http/auth.controller';
import { AuthGuard } from './presentation/guards/auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';
import { PermissionsGuard } from './presentation/guards/permissions.guard';
import { USUARIO_REPOSITORY_PORT } from './domain/ports/usuario-repository.port';
import { InMemoryUsuarioRepository } from './infrastructure/persistence/in-memory-usuario.repository';

@Module({
  imports: [
    JwtModule.register({
      global: false,
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: USUARIO_REPOSITORY_PORT,
      useClass: InMemoryUsuarioRepository,
    },
    AuthService,
    HashingService,
    TokenService,
    PinThrottlerService,
    AuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    USUARIO_REPOSITORY_PORT,
    AuthService,
    HashingService,
    TokenService,
    PinThrottlerService,
    AuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}

