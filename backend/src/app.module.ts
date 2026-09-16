import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { CatalogModule } from './catalog/catalog.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { PoliciesModule } from './policies/policies.module';
import { FxModule } from './fx/fx.module';
import { QuotesModule } from './quotes/quotes.module';
import { EndorsementsModule } from './endorsements/endorsements.module';
import { FinanceModule } from './finance/finance.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { GmailModule } from './gmail/gmail.module';
import { CommunicationsModule } from './communications/communications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    MailModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CatalogModule,
    CompaniesModule,
    EmployeesModule,
    PoliciesModule,
    FxModule,
    QuotesModule,
    EndorsementsModule,
    FinanceModule,
    SettingsModule,
    GmailModule,
    CommunicationsModule,
  ],
})
export class AppModule {}
