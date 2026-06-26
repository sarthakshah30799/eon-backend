import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { UserModule } from "./users/user.module";
import { AuthModule } from "./auth/auth.module";
import { CompanyModule } from "./company/company.module";
import { BranchModule } from "./branches/branch.module";
import { CounterModule } from "./counters/counter.module";
import { RoleModule } from "./roles/role.module";
import { MenuModule } from "./menu/menu.module";
import { CountryModule } from "./country/country.module";
import { StateModule } from "./state/state.module";
import { SelectOptionModule } from "./category-options/category-option.module";
import { ProductModule } from "./products/product.module";
import { CurrencyModule } from "./currencies/currency.module";
import { AdditionalSettingModule } from "./additional-settings/additional-setting.module";
import { SessionMiddleware } from "./auth/session.middleware";
import { FinancialCodeModule } from "./financial-codes/financial-code.module";
import { FinancialSubProfileModule } from "./financial-sub-profiles/financial-sub-profile.module";
import { AccountProfileModule } from "./account-profiles/account-profile.module";
import { CountryGroupModule } from "./country-groups/country-group.module";
import { PartyProfileModule } from "./party-profiles/party-profile.module";
import { PartyProfileDocumentsModule } from "./party-profile-documents/party-profile-documents.module";
import { DocumentProfileModule } from "./document-profiles/document-profile.module";
import { TdsProfileModule } from "./tds-profiles/tds-profile.module";
import { ExpenseIncomeBookingMasterModule } from "./expense-income-booking-masters/expense-income-booking-master.module";
import { AuditLogModule } from "./audit-logs/audit-log.module";
import { SessionPolicyModule } from "./session-policy/session-policy.module";
import { MailModule } from "./mail/mail.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    UserModule,
    AuthModule,
    CompanyModule,
    BranchModule,
    CounterModule,
    RoleModule,
    MenuModule,
    CountryModule,
    StateModule,
    SelectOptionModule,
    ProductModule,
    CurrencyModule,
    AdditionalSettingModule,
    SessionPolicyModule,
    FinancialCodeModule,
    FinancialSubProfileModule,
    AccountProfileModule,
    CountryGroupModule,
    PartyProfileModule,
    PartyProfileDocumentsModule,
    DocumentProfileModule,
    TdsProfileModule,
    ExpenseIncomeBookingMasterModule,
    MailModule,
    AuditLogModule,
    StorageModule,
  ],
  providers: [SessionMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes("*");
  }
}
