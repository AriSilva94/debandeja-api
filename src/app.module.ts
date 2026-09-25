import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/http/app-throttler.guard';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { OnboardingModule } from './onboarding/onboarding.module';
import { TeamModule } from './team/team.module';
import { InvitesModule } from './invites/invites.module';
import { BranchesModule } from './branches/branches.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { MovementsModule } from './movements/movements.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AlertsModule } from './alerts/alerts.module';
import { MeModule } from './me/me.module';
import { BillingModule } from './billing/billing.module';
import { CompanyModule } from './company/company.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: new Redis(config.get<string>('REDIS_URL')!, {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    OnboardingModule,
    TeamModule,
    InvitesModule,
    BranchesModule,
    ProductsModule,
    StockModule,
    MovementsModule,
    DashboardModule,
    AlertsModule,
    MeModule,
    BillingModule,
    CompanyModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
