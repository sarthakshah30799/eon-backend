import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Branch } from '../branches/branch.entity';
import { Counter } from '../counters/counter.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { MailService } from '../mail/mail.service';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { Product } from '../products/product.entity';
import { Currency } from '../currencies/currency.entity';
import { ProductCurrencyRate } from '../currency-rates/product-currency-rate.entity';
import { loadEntitySnapshot } from '../common/snapshot/entity-snapshot.util';
import { toUtcDateOnly } from '../common/date/date.util';
import { TransactionReferenceSnapshotValue } from '../transactions/types/transaction-snapshot.types';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionItem } from '../transactions/entities/transaction-item.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { CurrencyTransfer, CurrencyTransferItem } from './entities';
import {
  CurrencyTransferStatus,
  CurrencyTransferType,
} from './transfers.enums';
import {
  CreateTransferRequestPayload,
  TransferRequestItemPayload,
} from './dto/transfer-request.dto';
import { RecordTransferPrintDto, TransferPrintCopyType } from './dto/record-transfer-print.dto';
import {
  TradeMode,
  TransactionPartyProfileTypeEnum,
  TransactionStatus,
  TransactionType,
} from '../transactions/transactions.enums';
import { resolveProductTransactionAccount, roundMoney } from '../transactions/transaction-accounting.util';

type TransferSeriesMapping = {
  source: string;
  destination: string;
};

const TRANSFER_SERIES: Record<CurrencyTransferType, TransferSeriesMapping> = {
  COUNTER: {
    source: 'COUNTER_TRANSFER_SELL',
    destination: 'COUNTER_TRANSFER_PURCHASE',
  },
  BRANCH: {
    source: 'BRANCH_TRANSFER_SELL',
    destination: 'BRANCH_TRANSFER_PURCHASE',
  },
};

const normalizeString = (value: unknown): string =>
  String(value ?? '').trim();

const toNumber = (value: unknown): number => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
};

const roundToScale = (value: number, scale = 2): string => {
  if (!Number.isFinite(value)) {
    return (0).toFixed(scale);
  }
  return value.toFixed(scale);
};

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    @InjectRepository(CurrencyTransfer, 'database2')
    private readonly transferRepository: Repository<CurrencyTransfer>,
    @InjectRepository(CurrencyTransferItem, 'database2')
    private readonly transferItemRepository: Repository<CurrencyTransferItem>,
    @InjectRepository(Transaction, 'database2')
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionItem, 'database2')
    private readonly transactionItemRepository: Repository<TransactionItem>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(ProductCurrencyRate)
    private readonly productCurrencyRateRepository: Repository<ProductCurrencyRate>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    private readonly transactionsService: TransactionsService,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly mailService: MailService,
  ) {}

  private async resolveTransferNumber(transferType: CurrencyTransferType, branchCode: string): Promise<string> {
    const seriesCode = TRANSFER_SERIES[transferType].source;
    return this.additionalSettingService.reserveTransactionNumber(seriesCode, branchCode);
  }

  private async assertBranchCounterAccess(params: {
    transferType: CurrencyTransferType;
    sourceBranchId: string;
    sourceCounterId: string;
    destinationBranchId: string;
    destinationCounterId: string;
    isAdmin: boolean;
    isHoStaff: boolean;
    activeBranchId: string | null;
    activeCounterId: string | null;
  }) {
    const {
      transferType,
      sourceBranchId,
      sourceCounterId,
      destinationBranchId,
      destinationCounterId,
      isAdmin,
      isHoStaff,
      activeBranchId,
      activeCounterId,
    } = params;

    if (!isAdmin && !isHoStaff) {
      if (!activeBranchId || !activeCounterId) {
        throw new ForbiddenException('Active branch and counter are required');
      }

      if (sourceBranchId !== activeBranchId || sourceCounterId !== activeCounterId) {
        throw new ForbiddenException('You can only create transfers from your active branch and counter');
      }

      if (
        transferType === CurrencyTransferType.COUNTER &&
        destinationBranchId !== activeBranchId
      ) {
        throw new ForbiddenException('Counter transfers must stay within the active branch');
      }
    }
  }

  private assertApprovalAccess(params: {
    destinationBranchId: string;
    destinationCounterId: string;
    isAdmin: boolean;
    isHoStaff: boolean;
    activeBranchId: string | null;
    activeCounterId: string | null;
  }) {
    const {
      destinationBranchId,
      destinationCounterId,
      isAdmin,
      isHoStaff,
      activeBranchId,
      activeCounterId,
    } = params;

    if (isAdmin || isHoStaff) {
      return;
    }

    if (!activeBranchId || !activeCounterId) {
      throw new ForbiddenException('Active branch and counter are required');
    }

    if (destinationBranchId !== activeBranchId || destinationCounterId !== activeCounterId) {
      throw new ForbiddenException('Only the destination branch and counter can approve or reject this transfer');
    }
  }

  private async resolveSnapshots(params: {
    sourceBranchId: string;
    sourceCounterId: string;
    destinationBranchId: string;
    destinationCounterId: string;
  }): Promise<{
    sourceBranchSnapshot: TransactionReferenceSnapshotValue;
    sourceCounterSnapshot: TransactionReferenceSnapshotValue;
    destinationBranchSnapshot: TransactionReferenceSnapshotValue;
    destinationCounterSnapshot: TransactionReferenceSnapshotValue;
  }> {
    const {
      sourceBranchId,
      sourceCounterId,
      destinationBranchId,
      destinationCounterId,
    } = params;

    const [sourceBranchSnapshot, sourceCounterSnapshot, destinationBranchSnapshot, destinationCounterSnapshot] = await Promise.all([
      loadEntitySnapshot(this.branchRepository, sourceBranchId),
      loadEntitySnapshot(this.counterRepository, sourceCounterId),
      loadEntitySnapshot(this.branchRepository, destinationBranchId),
      loadEntitySnapshot(this.counterRepository, destinationCounterId),
    ]);

    if (!sourceBranchSnapshot) {
      throw new NotFoundException(`Source branch with id ${sourceBranchId} not found`);
    }
    if (!sourceCounterSnapshot) {
      throw new NotFoundException(`Source counter with id ${sourceCounterId} not found`);
    }
    if (!destinationBranchSnapshot) {
      throw new NotFoundException(`Destination branch with id ${destinationBranchId} not found`);
    }
    if (!destinationCounterSnapshot) {
      throw new NotFoundException(`Destination counter with id ${destinationCounterId} not found`);
    }

    return {
      sourceBranchSnapshot: sourceBranchSnapshot as TransactionReferenceSnapshotValue,
      sourceCounterSnapshot: sourceCounterSnapshot as TransactionReferenceSnapshotValue,
      destinationBranchSnapshot: destinationBranchSnapshot as TransactionReferenceSnapshotValue,
      destinationCounterSnapshot: destinationCounterSnapshot as TransactionReferenceSnapshotValue,
    };
  }

  private async resolveItemSnapshots(item: TransferRequestItemPayload) {
    const [currencySnapshot, productSnapshot] = await Promise.all([
      loadEntitySnapshot(this.currencyRepository, normalizeString(item.currencyId)),
      loadEntitySnapshot(this.productRepository, normalizeString(item.productId)),
    ]);

    if (!currencySnapshot) {
      throw new NotFoundException(`Currency with id ${normalizeString(item.currencyId)} not found`);
    }
    if (!productSnapshot) {
      throw new NotFoundException(`Product with id ${normalizeString(item.productId)} not found`);
    }

    return {
      currencySnapshot: currencySnapshot as TransactionReferenceSnapshotValue,
      productSnapshot: productSnapshot as TransactionReferenceSnapshotValue,
    };
  }

  private async assertAvailableCounterQuantity(params: {
    branchId: string;
    counterId: string;
    items: Array<{
      currencyId: string;
      productId: string;
      quantity: number;
    }>;
  }) {
    const { branchId, counterId, items } = params;
    const groupedItems = new Map<string, { currencyId: string; productId: string; quantity: number }>();

    for (const item of items) {
      const key = `${item.currencyId}:${item.productId}`;
      const existing = groupedItems.get(key);
      if (existing) {
        existing.quantity += Number(item.quantity ?? 0);
        continue;
      }

      groupedItems.set(key, {
        currencyId: item.currencyId,
        productId: item.productId,
        quantity: Number(item.quantity ?? 0),
      });
    }

    for (const item of groupedItems.values()) {
      const availability = await this.transactionsService.getQuantityAvailability(
        branchId,
        counterId,
        item.currencyId,
        item.productId,
      );

      const availableQuantity = Number(availability.availableQuantity ?? 0);
      if (item.quantity > availableQuantity) {
        throw new BadRequestException(
          `Requested quantity exceeds available counter stock of ${roundToScale(availableQuantity, 7)}`,
        );
      }
    }
  }

  private async validateTransferRates(
    items: Array<{ currencyId: string; productId: string; quantity: number; per: number; rate: number }>,
    branchId: string,
    counterId: string,
  ) {
    const configured = String(
      await this.additionalSettingService.getSettingTextValue('TRANSFER_SETTINGS', 'TRANSFER_RATE_EDITABLE') ?? '',
    ).trim().toLowerCase();
    const rateEditable = configured === 'true' || configured === 'yes';

    for (const [index, item] of items.entries()) {
      const holdCost = await this.transactionsService.getCounterHoldCost(branchId, counterId, item.currencyId);
      const holdCostRate = Number(holdCost.holdCostRate ?? 0);
      if (!Number.isFinite(holdCostRate) || holdCostRate <= 0) {
        throw new BadRequestException(`Item ${index + 1}: source counter hold cost is unavailable`);
      }

      if (!Number.isFinite(item.rate) || item.rate <= 0) {
        throw new BadRequestException(`Item ${index + 1}: rate must be greater than zero`);
      }

      if (!rateEditable) {
        const expectedRate = holdCostRate * item.per;
        if (Math.abs(item.rate - expectedRate) > 0.0000001) {
          throw new BadRequestException(`Item ${index + 1}: rate must match the source counter hold cost of ${(expectedRate).toFixed(7)}`);
        }
        continue;
      }

      const rule = await this.productCurrencyRateRepository.findOne({
        where: { productId: item.productId, currencyId: item.currencyId, isActive: true },
      });
      const minRate = Number(rule?.saleMinRate ?? 0);
      const maxRate = Number(rule?.saleMaxRate ?? 0);
      if (rule?.saleMinRate && Number.isFinite(minRate) && item.rate < minRate) {
        throw new BadRequestException(`Item ${index + 1}: rate cannot be lower than ${minRate.toFixed(7)}`);
      }
      if (rule?.saleMaxRate && Number.isFinite(maxRate) && item.rate > maxRate) {
        throw new BadRequestException(`Item ${index + 1}: rate cannot be higher than ${maxRate.toFixed(7)}`);
      }
    }
  }

  private normalizeTransferItems(items: TransferRequestItemPayload[] | undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('At least one transfer item is required');
    }

    return items.map((item, index) => {
      const quantity = toNumber(item.quantity);
      const per = toNumber(item.per);
      const rate = toNumber(item.rate);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`Item ${index + 1} quantity is required`);
      }
      if (!Number.isFinite(per) || per <= 0) {
        throw new BadRequestException(`Item ${index + 1} per is required`);
      }
      if (!Number.isFinite(rate) || rate < 0) {
        throw new BadRequestException(`Item ${index + 1} rate is required`);
      }

      const amount = Number.isFinite(toNumber(item.amount))
        ? toNumber(item.amount)
        : quantity * rate / per;
      const roundOff = Number.isFinite(toNumber(item.roundOff)) ? toNumber(item.roundOff) : 0;
      const finalAmount = Number.isFinite(toNumber(item.finalAmount))
        ? toNumber(item.finalAmount)
        : amount + roundOff;

      return {
        ...item,
        quantity,
        per,
        rate,
        amount,
        roundOff,
        finalAmount,
        rateEditable: Boolean(item.rateEditable),
        remarks: normalizeString(item.remarks) || null,
      };
    });
  }

  private buildTransferPartySnapshot(params: {
    snapshot: TransactionReferenceSnapshotValue;
    transferType: CurrencyTransferType;
    transferSide: 'source' | 'destination';
  }): TransactionReferenceSnapshotValue {
    const { snapshot, transferType, transferSide } = params;

    if (!snapshot) {
      return null;
    }

    const code = String(snapshot.code ?? '').trim();
    const name = String(snapshot.name ?? '').trim();
    const label = String(snapshot.label ?? '').trim() || [code, name].filter(Boolean).join(' - ');

    return {
      ...snapshot,
      id: String(snapshot.id ?? ''),
      code: code || null,
      name: name || null,
      label: label || name || code || null,
      type: transferType,
      transferSide,
    };
  }

  private async createTransferTransaction(params: {
    manager: EntityManager;
    transfer: CurrencyTransfer;
    transferType: CurrencyTransferType;
    transactionType: TransactionType;
    seriesCode: string;
    branchId: string;
    branchSnapshot: TransactionReferenceSnapshotValue;
    counterId: string;
    counterSnapshot: TransactionReferenceSnapshotValue;
    counterpartyId: string;
    counterpartySnapshot: TransactionReferenceSnapshotValue;
    performedById: string;
    items: TransferRequestItemPayload[];
    transactionDate: Date;
    remarks: string | null;
    number?: string | null;
  }): Promise<Transaction> {
    const {
      manager,
      transfer,
      transferType,
      transactionType,
      seriesCode,
      branchId,
      branchSnapshot,
      counterId,
      counterSnapshot,
      counterpartyId,
      counterpartySnapshot,
      performedById,
      items,
      transactionDate,
      remarks,
      number: requestedNumber,
    } = params;

    const branchCode = String(branchSnapshot?.code ?? '').trim();
    if (!branchCode) {
      throw new BadRequestException('Branch code is required to generate transaction number');
    }

    const number = requestedNumber ?? (await this.additionalSettingService.reserveTransactionNumber(
      seriesCode,
      branchCode,
      transactionDate,
    ));

    const transactionPartyProfileType =
      transferType === CurrencyTransferType.BRANCH
        ? TransactionPartyProfileTypeEnum.BRANCH
        : TransactionPartyProfileTypeEnum.COUNTER;

    const transactionRepo = manager.getRepository(Transaction);
    const transactionItemRepo = manager.getRepository(TransactionItem);
    const totalFinalAmount = items.reduce((sum, item) => sum + Number(item.finalAmount ?? 0), 0);

    const transaction = await transactionRepo.save(
      transactionRepo.create({
        rootTransactionId: null,
        revisionNo: 1,
        number,
        slug: seriesCode,
        transactionDate,
        branchId,
        branchSnapshot,
        counterId,
        counterSnapshot,
        companyId: null,
        companySnapshot: null,
        sacCode: null,
        partyProfileId: counterpartyId,
        partyProfileSnapshot: counterpartySnapshot,
        purposeId: null,
        transactionPartyProfileType,
        purposeSnapshot: null,
        passengerId: null,
        passengerSnapshot: null,
        passengerTravelId: null,
        passengerTravelSnapshot: null,
        transferRequestId: transfer.id,
        agentProfileId: null,
        agentProfileSnapshot: null,
        manualBookPageId: null,
        manualBookPageSnapshot: null,
        transactionType,
        tradeMode: TradeMode.BULK,
        status: TransactionStatus.APPROVED,
        remarks,
        submittedAt: transactionDate,
        approvedAt: transactionDate,
        rejectedAt: null,
        approvedById: performedById,
        rejectedById: null,
        approvalRemarks: null,
        rejectionReason: null,
        isLatest: true,
        byCash: null,
        byCheque: null,
        byCard: null,
        byTransfer: roundMoney(totalFinalAmount),
        byOther: null,
        taxRatePercent: null,
        preTcsFinalAmount: '0.00',
        tcsRatePercent: '0.00',
        tcsRateType: null,
        tcsAmount: '0.00',
        commissionAmount: '0.00',
        tdsAmount: '0.00',
        taxableAmount: '0.00',
        itemBaseAmount: '0.00',
        itemTaxableAmount: '0.00',
        itemTaxAmount: '0.00',
        additionalChargeBaseAmount: '0.00',
        additionalChargeTaxAmount: '0.00',
        igstAmount: '0.00',
        cgstAmount: '0.00',
        sgstAmount: '0.00',
        finalAmount: '0.00',
        loanAmount: null,
        declaredAmount: null,
        itrFiled: null,
        tcsDeclarationAccepted: null,
        isProprietorship: null,
        cdfNo: null,
        cdfIssuingAuthority: null,
        cdfApprovedUsd: null,
        cdfArrivalDate: null,
        splitMode: null,
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    const transactionItemRows = await Promise.all(
      items.map(async (item, index) => {
        const [currencySnapshot, productSnapshot] = await Promise.all([
          loadEntitySnapshot(this.currencyRepository, normalizeString(item.currencyId)),
          loadEntitySnapshot(this.productRepository, normalizeString(item.productId)),
        ]);

        if (!currencySnapshot) {
          throw new NotFoundException(`Currency with id ${normalizeString(item.currencyId)} not found`);
        }
        if (!productSnapshot) {
          throw new NotFoundException(`Product with id ${normalizeString(item.productId)} not found`);
        }

        const productEntity = await this.productRepository.findOne({
          where: { id: normalizeString(item.productId) },
          relations: ['bulkPurAc', 'purchaseAc', 'bulkSaleAc', 'saleAc', 'bulkProficAc', 'profitAc'],
        });
        if (!productEntity) {
          throw new NotFoundException(`Product with id ${normalizeString(item.productId)} not found`);
        }

        const itemAccount = resolveProductTransactionAccount(
          productEntity,
          transactionType,
          TradeMode.BULK,
          transactionType === TransactionType.SALE ? 'sale' : 'purchase',
        );

        if (!itemAccount) {
          throw new BadRequestException(
            `Product account is not configured for product ${item.productId}`,
          );
        }

        const accountSnapshot = await loadEntitySnapshot(
          this.accountProfileRepository,
          itemAccount.id,
        );

        return transactionItemRepo.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          currencyId: normalizeString(item.currencyId),
          productId: normalizeString(item.productId),
          accountId: itemAccount.id,
          accountSnapshot: accountSnapshot as TransactionReferenceSnapshotValue,
          currencyRateId: null,
          productCurrencyRateId: null,
          quantity: String(item.quantity),
          per: String(item.per),
          rate: String(item.rate),
          commission: null,
          currencySnapshot: currencySnapshot as TransactionReferenceSnapshotValue,
          productSnapshot: productSnapshot as TransactionReferenceSnapshotValue,
          currencyRateSnapshot: null,
          productCurrencyRateSnapshot: null,
          pricingRuleSnapshot: null,
          commissionSnapshot: null,
          remarks: item.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        });
      }),
    );

    await transactionItemRepo.save(transactionItemRows);

    return transaction;
  }

  async createHold(
    body: CreateTransferRequestPayload,
    performedById: string,
    activeBranchId: string | null,
    activeCounterId: string | null,
    isAdmin = false,
    isHoStaff = false,
  ): Promise<CurrencyTransfer> {
    if (!performedById) {
      throw new BadRequestException('User session not found');
    }

    const transferType = body.transferType;
    if (!transferType || !TRANSFER_SERIES[transferType]) {
      throw new BadRequestException('Transfer type is required');
    }

    const sourceBranchId = normalizeString(body.sourceBranchId) || activeBranchId || '';
    const sourceCounterId = normalizeString(body.sourceCounterId) || activeCounterId || '';
    const destinationBranchId = normalizeString(body.destinationBranchId) || sourceBranchId;
    const destinationCounterId = normalizeString(body.destinationCounterId);

    if (!sourceBranchId || !sourceCounterId || !destinationBranchId || !destinationCounterId) {
      throw new BadRequestException('Source branch, source counter, destination branch, and destination counter are required');
    }

    await this.assertBranchCounterAccess({
      transferType,
      sourceBranchId,
      sourceCounterId,
      destinationBranchId,
      destinationCounterId,
      isAdmin,
      isHoStaff,
      activeBranchId,
      activeCounterId,
    });

    const sourceBranch = await this.branchRepository.findOne({ where: { id: sourceBranchId } });
    if (!sourceBranch) {
      throw new NotFoundException(`Branch with id ${sourceBranchId} not found`);
    }
    const destinationBranch = await this.branchRepository.findOne({ where: { id: destinationBranchId } });
    if (!destinationBranch) {
      throw new NotFoundException(`Branch with id ${destinationBranchId} not found`);
    }
    const sourceCounter = await this.counterRepository.findOne({ where: { id: sourceCounterId }, relations: ['branch'] });
    if (!sourceCounter) {
      throw new NotFoundException(`Counter with id ${sourceCounterId} not found`);
    }
    const destinationCounter = await this.counterRepository.findOne({ where: { id: destinationCounterId }, relations: ['branch'] });
    if (!destinationCounter) {
      throw new NotFoundException(`Counter with id ${destinationCounterId} not found`);
    }
    if (sourceCounter.branch?.id !== sourceBranchId) {
      throw new BadRequestException('Source counter does not belong to the selected source branch');
    }
    if (destinationCounter.branch?.id !== destinationBranchId) {
      throw new BadRequestException('Destination counter does not belong to the selected destination branch');
    }
    if (transferType === CurrencyTransferType.BRANCH && sourceBranchId === destinationBranchId) {
      throw new BadRequestException('Branch transfers must move between different branches');
    }
    if (sourceBranchId === destinationBranchId && sourceCounterId === destinationCounterId) {
      throw new BadRequestException('Source and destination counters must be different');
    }

    const items = this.normalizeTransferItems(body.items);
    await this.validateTransferRates(items, sourceBranchId, sourceCounterId);
    await this.assertAvailableCounterQuantity({
      branchId: sourceBranchId,
      counterId: sourceCounterId,
      items,
    });
    const [snapshots, transferNumber] = await Promise.all([
      this.resolveSnapshots({
        sourceBranchId,
        sourceCounterId,
        destinationBranchId,
        destinationCounterId,
      }),
      this.resolveTransferNumber(transferType, sourceBranch.code),
    ]);

    const transfer = await this.transferRepository.save(
      this.transferRepository.create({
        number: transferNumber,
        transferType,
        status: CurrencyTransferStatus.HELD,
        transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
        billReference: normalizeString(body.billReference) || null,
        sourceBranchId,
        sourceBranchSnapshot: snapshots.sourceBranchSnapshot,
        sourceCounterId,
        sourceCounterSnapshot: snapshots.sourceCounterSnapshot,
        destinationBranchId,
        destinationBranchSnapshot: snapshots.destinationBranchSnapshot,
        destinationCounterId,
        destinationCounterSnapshot: snapshots.destinationCounterSnapshot,
        sourceNumberSeriesCode: TRANSFER_SERIES[transferType].source,
        destinationNumberSeriesCode: TRANSFER_SERIES[transferType].destination,
        remarks: normalizeString(body.remarks) || null,
        heldAt: new Date(),
        heldById: performedById,
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    const transferItems = await Promise.all(
      items.map(async (item, index) => {
        const { currencySnapshot, productSnapshot } = await this.resolveItemSnapshots(item);
        return this.transferItemRepository.create({
          transferId: transfer.id,
          lineNo: index + 1,
          currencyId: normalizeString(item.currencyId),
          currencySnapshot,
          productId: normalizeString(item.productId),
          productSnapshot,
          quantity: roundToScale(item.quantity, 7),
          per: roundToScale(item.per, 7),
          rate: roundToScale(item.rate, 7),
          rateEditable: Boolean(item.rateEditable),
          amount: roundToScale(item.amount, 2),
          roundOff: roundToScale(item.roundOff, 2),
          finalAmount: roundToScale(item.finalAmount, 2),
          remarks: item.remarks,
          createdBy: performedById,
          updatedBy: performedById,
        });
      }),
    );

    await this.transferItemRepository.save(transferItems);

    await this.notifyCounterUsers({
      branchId: destinationBranchId,
      counterId: destinationCounterId,
      subject: `Transfer request ${transfer.number ?? ''}`.trim(),
      text: `A ${transferType.toLowerCase()} transfer request has been held for approval.`,
    });

    return this.findById(transfer.id);
  }

  async findAll(params?: {
    transferType?: CurrencyTransferType;
    branchId?: string;
    counterId?: string;
    status?: CurrencyTransferStatus;
    search?: string;
  }): Promise<CurrencyTransfer[]> {
    const query = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.items', 'items')
      .orderBy('transfer.createdAt', 'DESC')
      .addOrderBy('items.lineNo', 'ASC');

    if (params?.transferType) {
      query.andWhere('transfer.transferType = :transferType', { transferType: params.transferType });
    }
    if (params?.branchId) {
      query.andWhere('(transfer.sourceBranchId = :branchId OR transfer.destinationBranchId = :branchId)', {
        branchId: params.branchId,
      });
    }
    if (params?.counterId) {
      query.andWhere('(transfer.sourceCounterId = :counterId OR transfer.destinationCounterId = :counterId)', {
        counterId: params.counterId,
      });
    }
    if (params?.status) {
      query.andWhere('transfer.status = :status', { status: params.status });
    }
    if (params?.search) {
      query.andWhere(
        '(transfer.number ILIKE :search OR transfer.billReference ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    return this.hydrateWorkplaceRelations(await query.getMany());
  }

  private async hydrateWorkplaceRelations(
    transfers: CurrencyTransfer[],
  ): Promise<CurrencyTransfer[]> {
    const branchIds = [
      ...transfers.map(transfer => transfer.sourceBranchId),
      ...transfers.map(transfer => transfer.destinationBranchId),
    ];
    const counterIds = [
      ...transfers.map(transfer => transfer.sourceCounterId),
      ...transfers.map(transfer => transfer.destinationCounterId),
    ];

    if (transfers.length === 0) {
      return transfers;
    }

    const [branches, counters] = await Promise.all([
      this.branchRepository.find({ where: { id: In(branchIds) } }),
      this.counterRepository.find({ where: { id: In(counterIds) } }),
    ]);
    const branchById = new Map(branches.map(branch => [branch.id, branch]));
    const counterById = new Map(counters.map(counter => [counter.id, counter]));

    return transfers.map(transfer => {
      transfer.sourceBranch = branchById.get(transfer.sourceBranchId) ?? null;
      transfer.sourceCounter = counterById.get(transfer.sourceCounterId) ?? null;
      transfer.destinationBranch = branchById.get(transfer.destinationBranchId) ?? null;
      transfer.destinationCounter = counterById.get(transfer.destinationCounterId) ?? null;
      return transfer;
    });
  }

  async findById(id: string): Promise<CurrencyTransfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: {
        items: true,
        sourceTransaction: true,
        destinationTransaction: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with id ${id} not found`);
    }

    const [hydratedTransfer] = await this.hydrateWorkplaceRelations([transfer]);
    return hydratedTransfer;
  }

  async recordPrint(
    id: string,
    dto: RecordTransferPrintDto,
    _performedById: string | null,
    activeBranchId: string | null,
    activeCounterId: string | null,
    isAdmin = false,
    isHoStaff = false,
  ): Promise<{ message: string }> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: {
        items: true,
        sourceTransaction: true,
        destinationTransaction: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with id ${id} not found`);
    }

    if (transfer.status !== CurrencyTransferStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted transfers can be printed');
    }

    if (!isAdmin && !isHoStaff) {
      if (!activeBranchId || !activeCounterId) {
        throw new ForbiddenException('Active branch and counter are required');
      }

      const canAccessAsSource =
        transfer.sourceBranchId === activeBranchId &&
        transfer.sourceCounterId === activeCounterId;
      const canAccessAsDestination =
        transfer.destinationBranchId === activeBranchId &&
        transfer.destinationCounterId === activeCounterId;

      if (!canAccessAsSource && !canAccessAsDestination) {
        throw new ForbiddenException('You can only print transfers for your active branch and counter');
      }
    }

    const copyType = (dto.copyType ?? TransferPrintCopyType.CUSTOMER_COPY) as TransferPrintCopyType;
    const printLabel = copyType === TransferPrintCopyType.DUPLICATE_COPY ? 'Duplicate copy printed' : 'Original copy printed';

    if (dto.sendEmail) {
      const subject =
        dto.subject || `Transfer ${transfer.number ?? ''} - ${copyType === TransferPrintCopyType.DUPLICATE_COPY ? 'Duplicate Copy' : 'Original Copy'}`;
      const text =
        dto.text || `Please find the ${copyType === TransferPrintCopyType.DUPLICATE_COPY ? 'duplicate' : 'original'} copy for transfer ${transfer.number ?? ''}.`;

      if (dto.recipientEmail) {
        await this.mailService.sendEmail({
          to: dto.recipientEmail,
          subject,
          text,
          html: dto.html,
        });
      } else {
        await this.notifyCounterUsers({
          branchId: transfer.destinationBranchId,
          counterId: transfer.destinationCounterId,
          subject,
          text,
          html: dto.html,
        });
      }
    }

    return {
      message: printLabel,
    };
  }

  async acceptTransfer(
    id: string,
    performedById: string,
    activeBranchId: string | null,
    activeCounterId: string | null,
    isAdmin = false,
    isHoStaff = false,
  ): Promise<CurrencyTransfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with id ${id} not found`);
    }

    if (transfer.status !== CurrencyTransferStatus.HELD) {
      throw new BadRequestException('Only held transfers can be accepted');
    }

    this.assertApprovalAccess({
      destinationBranchId: transfer.destinationBranchId,
      destinationCounterId: transfer.destinationCounterId,
      isAdmin,
      isHoStaff,
      activeBranchId,
      activeCounterId,
    });

    const [sourceBranchSnapshot, sourceCounterSnapshot, destinationBranchSnapshot, destinationCounterSnapshot] = await Promise.all([
      loadEntitySnapshot(this.branchRepository, transfer.sourceBranchId),
      loadEntitySnapshot(this.counterRepository, transfer.sourceCounterId),
      loadEntitySnapshot(this.branchRepository, transfer.destinationBranchId),
      loadEntitySnapshot(this.counterRepository, transfer.destinationCounterId),
    ]);

    if (!sourceBranchSnapshot || !sourceCounterSnapshot || !destinationBranchSnapshot || !destinationCounterSnapshot) {
      throw new NotFoundException('Unable to resolve transfer branch or counter snapshots');
    }

    const sourceItems = await this.normalizeTransferItems(
      (transfer.items ?? []).map((item) => ({
        currencyId: item.currencyId,
        productId: item.productId,
        quantity: item.quantity,
        per: item.per,
        rate: item.rate,
        rateEditable: item.rateEditable,
        amount: item.amount,
        roundOff: item.roundOff,
        finalAmount: item.finalAmount,
        remarks: item.remarks,
      })),
    );
    await this.assertAvailableCounterQuantity({
      branchId: transfer.sourceBranchId,
      counterId: transfer.sourceCounterId,
      items: sourceItems,
    });
    await this.validateTransferRates(sourceItems, transfer.sourceBranchId, transfer.sourceCounterId);

    const acceptedAt = new Date();
    const transactionDate = toUtcDateOnly(transfer.transactionDate);

    await this.transferRepository.manager.transaction(async (manager) => {
      const sourceCounterpartySnapshot = this.buildTransferPartySnapshot({
        snapshot:
          transfer.transferType === CurrencyTransferType.BRANCH
            ? (destinationBranchSnapshot as TransactionReferenceSnapshotValue)
            : (destinationCounterSnapshot as TransactionReferenceSnapshotValue),
        transferType: transfer.transferType,
        transferSide: 'source',
      });
      const destinationCounterpartySnapshot = this.buildTransferPartySnapshot({
        snapshot:
          transfer.transferType === CurrencyTransferType.BRANCH
            ? (sourceBranchSnapshot as TransactionReferenceSnapshotValue)
            : (sourceCounterSnapshot as TransactionReferenceSnapshotValue),
        transferType: transfer.transferType,
        transferSide: 'destination',
      });

      const sourceTransaction = await this.createTransferTransaction({
        manager,
        transfer,
        transferType: transfer.transferType,
        transactionType: TransactionType.SALE,
        seriesCode:
          transfer.sourceNumberSeriesCode ??
          (transfer.transferType === CurrencyTransferType.BRANCH
            ? 'BRANCH_TRANSFER_SELL'
            : 'COUNTER_TRANSFER_SELL'),
        branchId: transfer.sourceBranchId,
        branchSnapshot: sourceBranchSnapshot as TransactionReferenceSnapshotValue,
        counterId: transfer.sourceCounterId,
        counterSnapshot: sourceCounterSnapshot as TransactionReferenceSnapshotValue,
        counterpartyId:
          transfer.transferType === CurrencyTransferType.BRANCH
            ? transfer.destinationBranchId
            : transfer.destinationCounterId,
        counterpartySnapshot: sourceCounterpartySnapshot,
        performedById,
        items: sourceItems,
        transactionDate,
        remarks: transfer.remarks ?? `Transfer request ${transfer.number ?? ''}`.trim(),
        number: transfer.number,
      });

      const destinationTransaction = await this.createTransferTransaction({
        manager,
        transfer,
        transferType: transfer.transferType,
        transactionType: TransactionType.PURCHASE,
        seriesCode:
          transfer.destinationNumberSeriesCode ??
          (transfer.transferType === CurrencyTransferType.BRANCH
            ? 'BRANCH_TRANSFER_PURCHASE'
            : 'COUNTER_TRANSFER_PURCHASE'),
        branchId: transfer.destinationBranchId,
        branchSnapshot: destinationBranchSnapshot as TransactionReferenceSnapshotValue,
        counterId: transfer.destinationCounterId,
        counterSnapshot: destinationCounterSnapshot as TransactionReferenceSnapshotValue,
        counterpartyId:
          transfer.transferType === CurrencyTransferType.BRANCH
            ? transfer.sourceBranchId
            : transfer.sourceCounterId,
        counterpartySnapshot: destinationCounterpartySnapshot,
        performedById,
        items: sourceItems,
        transactionDate,
        remarks: transfer.remarks ?? `Transfer request ${transfer.number ?? ''}`.trim(),
      });

      transfer.status = CurrencyTransferStatus.ACCEPTED;
      transfer.acceptedAt = acceptedAt;
      transfer.acceptedById = performedById;
      transfer.sourceTransactionId = sourceTransaction.id;
      transfer.destinationTransactionId = destinationTransaction.id;
      transfer.updatedBy = performedById;

      await manager.getRepository(CurrencyTransfer).save(transfer);
    });

    await this.notifyCounterUsers({
      branchId: transfer.sourceBranchId,
      counterId: transfer.sourceCounterId,
      subject: `Transfer accepted ${transfer.number ?? ''}`.trim(),
      text: `Transfer request ${transfer.number ?? ''} has been accepted.`,
    });

    return this.findById(transfer.id);
  }

  async rejectTransfer(
    id: string,
    performedById: string,
    remarks?: string | null,
    activeBranchId: string | null = null,
    activeCounterId: string | null = null,
    isAdmin = false,
    isHoStaff = false,
  ): Promise<CurrencyTransfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with id ${id} not found`);
    }

    if (transfer.status !== CurrencyTransferStatus.HELD) {
      throw new BadRequestException('Only held transfers can be rejected');
    }

    const rejectionReason = normalizeString(remarks);
    if (!rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    this.assertApprovalAccess({
      destinationBranchId: transfer.destinationBranchId,
      destinationCounterId: transfer.destinationCounterId,
      isAdmin,
      isHoStaff,
      activeBranchId,
      activeCounterId,
    });

    transfer.status = CurrencyTransferStatus.REJECTED;
    transfer.rejectedAt = new Date();
    transfer.rejectedById = performedById;
    transfer.remarks = rejectionReason;
    transfer.updatedBy = performedById;

    await this.transferRepository.save(transfer);
    return this.findById(transfer.id);
  }

  private async notifyCounterUsers(params: {
    branchId: string;
    counterId: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    try {
      const userRoles = await this.userRoleRepository
        .createQueryBuilder('userRole')
        .leftJoinAndSelect('userRole.user', 'user')
        .leftJoinAndSelect('userRole.branch', 'branch')
        .leftJoinAndSelect('userRole.counter', 'counter')
        .where('branch.id = :branchId', { branchId: params.branchId })
        .andWhere('counter.id = :counterId', { counterId: params.counterId })
        .getMany();

      const recipients = Array.from(
        new Map(
          userRoles
            .map(userRole => userRole.user)
            .filter((user): user is User => Boolean(user?.email))
            .map(user => [user.id, user] as const),
        ).values(),
      );

      for (const recipient of recipients) {
        await this.mailService.sendEmail({
          to: recipient.email,
          subject: params.subject,
          text: params.text,
          html: params.html,
        });
      }
    } catch (error) {
      this.logger.warn(`Transfer notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
