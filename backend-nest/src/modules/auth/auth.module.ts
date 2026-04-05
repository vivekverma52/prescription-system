import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenInterceptor } from '../../common/interceptors/refresh-token.interceptor';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Registered here so NestJS can inject ConfigService + Reflector
    // when @UseInterceptors(RefreshTokenInterceptor) resolves it from DI
    RefreshTokenInterceptor,
  ],
  exports: [AuthService],
})
export class AuthModule {}
