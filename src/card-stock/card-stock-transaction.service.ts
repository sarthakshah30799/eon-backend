import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { Branch } from "../branches/branch.entity";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import {
  TradeMode,
  TransactionPartyProfileTypeEnum,
  TransactionStatus,
  TransactionType,
  type TransactionTypeProfile,
} from "../transactions/transactions.enums";
import { CardStockReferenceType } from "./card-stock.enums";

export interface CardStockTransactionInput {
  manager: EntityManager;
  operationCode: string;
  numberingCode?: TransactionTypeProfile;
  number?: string;
  branch: Branch;
  transactionDate: Date | string;
  referenceType?: CardStockReferenceType;
  referenceId?: string;
  actorId: string;
  transactionType?: TransactionType;
  items?: Array<{
    cardId?: string;
    currencyId: string;
    productId: string;
    quantity?: string | number;
    per?: string | number;
    rate?: string | number;
    cardSnapshot?: Record<string, unknown>;
    referenceType?: CardStockReferenceType;
    referenceId?: string;
  }>;
}

@Injectable()
export class CardStockTransactionService {
  constructor(
    private readonly additionalSettingService: AdditionalSettingService,
  ) {}

  async create(input: CardStockTransactionInput): Promise<Transaction> {
    const number =
      input.number ??
      (await this.additionalSettingService.reserveTransactionNumber(
        input.numberingCode ?? input.operationCode,
        input.branch.code,
        new Date(input.transactionDate),
      ));
    const transactionRepository = input.manager.getRepository(Transaction);
    await input.manager.query(
      `SELECT set_config('app.skip_transaction_account_postings_enqueue', 'true', true)`,
    );
    const transaction = await transactionRepository.save(
      transactionRepository.create({
        number,
        slug: input.operationCode,
        transactionDate: input.transactionDate,
        branchId: input.branch.id,
        branchSnapshot: {
          id: input.branch.id,
          code: input.branch.code,
          name: input.branch.name,
          label: `${input.branch.code} - ${input.branch.name}`,
        },
        counterId: null,
        counterSnapshot: null,
        partyProfileId: null,
        partyProfileSnapshot: null,
        transactionPartyProfileType: TransactionPartyProfileTypeEnum.BRANCH,
        transactionType: input.transactionType ?? TransactionType.PURCHASE,
        tradeMode: TradeMode.BULK,
        status: TransactionStatus.APPROVED,
        remarks: `CARD ${input.operationCode}`,
        submittedAt: new Date(input.transactionDate),
        approvedAt: new Date(input.transactionDate),
        approvedById: input.actorId,
        isLatest: true,
        cardStockReferenceType: input.referenceType ?? null,
        cardStockReferenceId: input.referenceId ?? null,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      }),
    );

    if (input.items?.length) {
      const itemRepository = input.manager.getRepository(TransactionItem);
      const sortedItems = [...input.items].sort((left, right) =>
        String(left.referenceId ?? left.cardId ?? '').localeCompare(String(right.referenceId ?? right.cardId ?? ''))
      );
      for (const [index, item] of sortedItems.entries()) {
        await itemRepository.save(
          itemRepository.create({
            transactionId: transaction.id,
            transaction,
            lineNo: index + 1,
            cardId: item.cardId ?? null,
            cardStockReferenceType: item.referenceType ?? null,
            cardStockReferenceId: item.referenceId ?? null,
            currencyId: item.currencyId,
            productId: item.productId,
            quantity: String(item.quantity ?? 1),
            per: String(item.per ?? 1),
            rate: String(item.rate ?? 0),
            cardSnapshot: item.cardSnapshot ?? null,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }),
        );
      }
    }
    const createsBranchSettlementPosting = input.items?.some(
      (item) =>
        item.referenceType === CardStockReferenceType.CARD_BRANCH_SETTLEMENT,
    );
    if (!createsBranchSettlementPosting) {
      await input.manager.query(
        `DELETE FROM transaction_events WHERE transaction_id = $1`,
        [transaction.id],
      );
    }
    await input.manager.query(
      `SELECT set_config('app.skip_transaction_account_postings_enqueue', 'false', true)`,
    );
    return transaction;
  }
}
