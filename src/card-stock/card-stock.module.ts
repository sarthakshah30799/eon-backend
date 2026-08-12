import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdditionalSettingModule } from '../additional-settings/additional-setting.module';
import { DayEndStartProcessModule } from '../day-end-start-process/day-end-start-process.module';
import { MailModule } from '../mail/mail.module';
import { Branch } from '../branches/branch.entity';
import { Currency } from '../currencies/currency.entity';
import { PartyProfile } from '../party-profiles/party-profile.entity';
import { Product } from '../products/product.entity';
import { ProductCardIssuer } from '../products/entities/product-card-issuer.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../user-roles/user-role.entity';
import {
  CardStockCard,
  CardStockReceipt,
  CardStockReceiptItem,
  CardTransferRequest,
  CardTransferRequestCard,
  CardTransferRequestItem,
  CardStockTransactionEntry,
  CardStockBalance,
} from './entities';
import { CardStockController } from './card-stock.controller';
import { CardStockService } from './card-stock.service';
import { CardTransferController } from './card-transfer.controller';
import { CardTransferService } from './card-transfer.service';
import { CardStockTechnicalTransactionService } from './card-stock-technical-transaction.service';

@Module({
  imports: [AdditionalSettingModule, DayEndStartProcessModule, MailModule, TypeOrmModule.forFeature([Branch, Currency, PartyProfile, Product, ProductCardIssuer, User, UserRole]), TypeOrmModule.forFeature([CardStockReceipt, CardStockReceiptItem, CardStockCard, CardTransferRequest, CardTransferRequestItem, CardTransferRequestCard, CardStockTransactionEntry, CardStockBalance], 'database2')],
  controllers: [CardStockController, CardTransferController],
  providers: [CardStockService, CardTransferService, CardStockTechnicalTransactionService],
  exports: [CardStockTechnicalTransactionService],
})
export class CardStockModule {}
