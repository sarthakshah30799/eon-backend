import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './users/user.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { BranchModule } from './branches/branch.module';
import { CounterModule } from './counters/counter.module';
import { RoleModule } from './roles/role.module';
import { MenuModule } from './menu/menu.module';
import { CountryModule } from './country/country.module';
import { StateModule } from './state/state.module';
import { SelectOptionModule } from './category-options/category-option.module';
import { ProductModule } from './products/product.module';
import { SessionMiddleware } from './auth/session.middleware';

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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SessionMiddleware)
      .forRoutes('*');
  }
}
