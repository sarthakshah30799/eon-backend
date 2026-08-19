import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionLog } from '../transactions/entities/transaction-log.entity';
import { TransactionLogAction } from '../transactions/transactions.enums';
import {
  CardStockPrintCopyType,
  CardStockPrintKind,
} from './dto/card-stock-print.dto';

@Injectable()
export class CardStockPrintService {
  constructor(
    @InjectRepository(TransactionLog, 'database2')
    private readonly transactionLogRepository: Repository<TransactionLog>,
  ) {}

  countPrints(transactionId: string): Promise<number> {
    return this.transactionLogRepository.count({
      where: {
        transactionId,
        action: TransactionLogAction.PRINT,
      },
    });
  }

  async recordPrint(input: {
    transactionId: string;
    performedById: string;
    kind: CardStockPrintKind;
    requestedCopyType?: CardStockPrintCopyType | null;
  }): Promise<{ copyType: CardStockPrintCopyType; message: string }> {
    const existingPrintCount = await this.countPrints(input.transactionId);
    const copyType =
      existingPrintCount === 0
        ? CardStockPrintCopyType.CUSTOMER_COPY
        : CardStockPrintCopyType.DUPLICATE_COPY;
    const message =
      copyType === CardStockPrintCopyType.DUPLICATE_COPY
        ? 'Duplicate copy printed'
        : 'Original copy printed';

    await this.transactionLogRepository.save(
      this.transactionLogRepository.create({
        transactionId: input.transactionId,
        action: TransactionLogAction.PRINT,
        message,
        metadata: {
          copyType,
          requestedCopyType: input.requestedCopyType ?? null,
          kind: input.kind,
          sendEmail: false,
        },
        performedById: input.performedById,
        createdBy: input.performedById,
        updatedBy: input.performedById,
      }),
    );

    return { copyType, message };
  }
}
