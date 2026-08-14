import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import { Branch } from '../branches/branch.entity';
import { Currency } from '../currencies/currency.entity';
import { Product } from '../products/product.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionItem } from '../transactions/entities/transaction-item.entity';
import { TradeMode, TransactionPartyProfileTypeEnum, TransactionStatus, TransactionType, TransactionTypeProfileEnum, type TransactionTypeProfile } from '../transactions/transactions.enums';
import { CardStockReferenceType } from './card-stock.enums';

export interface CardTechnicalTransactionInput {
  manager: EntityManager;
  operationCode: string;
  branch: Branch;
  transactionDate: Date | string;
  referenceType: CardStockReferenceType;
  referenceId: string;
  actorId: string;
  transactionType?: TransactionType;
  items?: Array<{ cardId?: string; currencyId: string; productId: string; quantity?: string | number; per?: string | number; rate?: string | number; cardSnapshot?: Record<string, unknown> }>;
}

@Injectable()
export class CardStockTechnicalTransactionService {
  constructor(
    @InjectDataSource('database2') private readonly database2: DataSource,
    private readonly additionalSettingService: AdditionalSettingService,
  ) {}

  async create(input: CardTechnicalTransactionInput): Promise<Transaction> {
    const number = await this.additionalSettingService.reserveTransactionNumber(
      input.operationCode as TransactionTypeProfile,
      input.branch.code,
      new Date(input.transactionDate),
    );
    const transactionRepository = input.manager.getRepository(Transaction);
    await input.manager.query(`SELECT set_config('app.skip_transaction_account_postings_enqueue', 'true', true)`);
    const transaction = await transactionRepository.save(transactionRepository.create({
      number,
      slug: input.operationCode,
      transactionDate: input.transactionDate,
      branchId: input.branch.id,
      branchSnapshot: { id: input.branch.id, code: input.branch.code, name: input.branch.name, label: `${input.branch.code} - ${input.branch.name}` },
      counterId: null,
      counterSnapshot: null,
      partyProfileId: null,
      partyProfileSnapshot: null,
      transactionPartyProfileType: TransactionPartyProfileTypeEnum.BRANCH,
      transactionType: input.transactionType ?? TransactionType.PURCHASE,
      tradeMode: TradeMode.BULK,
      status: TransactionStatus.APPROVED,
      remarks: `Technical CARD ${input.operationCode}`,
      submittedAt: new Date(input.transactionDate),
      approvedAt: new Date(input.transactionDate),
      approvedById: input.actorId,
      isLatest: true,
      cardStockReferenceType: input.referenceType,
      cardStockReferenceId: input.referenceId,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    }));

    if (input.items?.length) {
      const itemRepository = input.manager.getRepository(TransactionItem);
      await itemRepository.save(input.items.map((item, index) => itemRepository.create({
        transactionId: transaction.id,
        transaction,
        lineNo: index + 1,
        cardId: item.cardId ?? null,
        currencyId: item.currencyId,
        productId: item.productId,
        quantity: String(item.quantity ?? 1),
        per: String(item.per ?? 1),
        rate: String(item.rate ?? 0),
        cardSnapshot: item.cardSnapshot ?? null,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })));
    }
    await input.manager.query(`DELETE FROM transaction_events WHERE transaction_id = $1`, [transaction.id]);
    await input.manager.query(`SELECT set_config('app.skip_transaction_account_postings_enqueue', 'false', true)`);
    return transaction;
  }
}
