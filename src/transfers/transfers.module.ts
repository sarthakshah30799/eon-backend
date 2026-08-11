import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/branch.entity';
import { Counter } from '../counters/counter.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { Product } from '../products/product.entity';
import { Currency } from '../currencies/currency.entity';
import { ProductCurrencyRate } from '../currency-rates/product-currency-rate.entity';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { AdditionalSettingModule } from '../additional-settings/additional-setting.module';
import { MailModule } from '../mail/mail.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CurrencyTransfer, CurrencyTransferItem } from './entities';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionItem } from '../transactions/entities/transaction-item.entity';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [
    AdditionalSettingModule,
    MailModule,
    TransactionsModule,
    TypeOrmModule.forFeature([Branch, Counter, User, UserRole, Product, Currency, ProductCurrencyRate, AccountProfile]),
    TypeOrmModule.forFeature([CurrencyTransfer, CurrencyTransferItem, Transaction, TransactionItem], 'database2'),
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
