import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleIdentityService } from './google-identity.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InternalBffGuard } from '../common/http/internal-bff.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleIdentityService,
    JwtStrategy,
    InternalBffGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
