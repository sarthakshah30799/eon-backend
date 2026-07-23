import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { TransactionLog } from './entities/transaction-log.entity';
import { Transaction } from './entities/transaction.entity';
import {
  TransactionLogAction,
  TransactionDocumentStatus,
  TransactionPaymentMethod,
  TransactionPaymentDirection,
  TransactionStatus,
  TransactionType,
} from './transactions.enums';
import { RecordTransactionPrintDto } from './dto/record-transaction-print.dto';
import { TransactionItem } from './entities/transaction-item.entity';
import { TransactionDocument } from './entities/transaction-document.entity';
import { TransactionAdditionalCharge } from './entities/transaction-additional-charge.entity';
import { TransactionPayment } from './entities/transaction-payment.entity';
import { TransactionAd1 } from './entities/transaction-ad1.entity';
import { TransactionPassengerOtherDocument } from './entities/transaction-passenger-other-document.entity';
import { Currency } from '../currencies/currency.entity';
import { Product } from '../products/product.entity';
import { DocumentProfile } from '../document-profiles/document-profile.entity';
import { StorageService } from '../storage/storage.service';
import {
  TransactionPassengerSnapshotValue,
  TransactionReferenceSnapshotValue,
} from './types/transaction-snapshot.types';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { PartyProfile } from '../party-profiles/party-profile.entity';
import { Passenger } from '../passengers/passenger.entity';
import { SelectOption } from '../category-options/category-option.entity';
import { Country } from '../country/country.entity';
import { State } from '../state/state.entity';
import { CompanyService } from '../company/company.service';
import { Branch } from '../branches/branch.entity';
import { Counter } from '../counters/counter.entity';
import { User } from '../users/user.entity';
import { ManualBookPageTracking } from '../manual-bill-books/entities/manual-book-page-tracking.entity';
import { ChequeBookPageTracking } from '../chequebooks/entities/cheque-book-page-tracking.entity';
import { loadEntitySnapshot } from '../common/snapshot/entity-snapshot.util';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import {
  resolveProductTransactionAccount,
  roundMoney,
} from './transaction-accounting.util';
import { TransactionEvent } from './entities/transaction-event.entity';
import { TransactionEventStatus, TransactionEventType } from './transactions.enums';

type UploadedDraftFile = {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction, 'database2')
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionAd1, 'database2')
    private readonly transactionAd1Repository: Repository<TransactionAd1>,
    @InjectRepository(TransactionItem, 'database2')
    private readonly transactionItemRepository: Repository<TransactionItem>,
    @InjectRepository(TransactionDocument, 'database2')
    private readonly transactionDocumentRepository: Repository<TransactionDocument>,
    @InjectRepository(TransactionAdditionalCharge, 'database2')
    private readonly transactionAdditionalChargeRepository: Repository<TransactionAdditionalCharge>,
    @InjectRepository(TransactionPayment, 'database2')
    private readonly transactionPaymentRepository: Repository<TransactionPayment>,
    @InjectRepository(TransactionLog, 'database2')
    private readonly transactionLogRepository: Repository<TransactionLog>,
    @InjectRepository(TransactionEvent, 'database2')
    private readonly transactionEventRepository: Repository<TransactionEvent>,
    @InjectRepository(TransactionPassengerOtherDocument, 'database2')
    private readonly transactionPassengerOtherDocumentRepository: Repository<TransactionPassengerOtherDocument>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(DocumentProfile)
    private readonly documentProfileRepository: Repository<DocumentProfile>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(Passenger)
    private readonly passengerRepository: Repository<Passenger>,
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ManualBookPageTracking, 'database2')
    private readonly manualBookPageTrackingRepository: Repository<ManualBookPageTracking>,
    @InjectRepository(ChequeBookPageTracking, 'database2')
    private readonly chequeBookPageTrackingRepository: Repository<ChequeBookPageTracking>,
    private readonly companyService: CompanyService,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
  ) { }

  async getAd1Agents(
    branchId: string,
    search?: string,
  ): Promise<any[]> {
    if (!branchId) {
      return [];
    }

    const qb = this.partyProfileRepository
      .createQueryBuilder("pp")
      .leftJoinAndSelect("pp.commissionRules", "commissionRules")
      .where("pp.branchId = :branchId", { branchId })
      .andWhere("pp.type = :type", { type: 'AGENT' })
      .andWhere("pp.active = :active", { active: true });

    if (search) {
      qb.andWhere(
        "(pp.code ILIKE :search OR pp.name ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    qb.orderBy("pp.createdAt", "DESC");

    return qb.getMany();
  }

  private parseJsonField<T>(value: unknown, fallback: T): T {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }

    return value as T;
  }

  private toNumber(value: unknown): number {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  private async resolveGstRatePercent(): Promise<number> {
    const configuredRate = await this.additionalSettingService.getSettingTextValue(
      'TAX_CONFIGURATION',
      'GST_RATE',
    );

    if (!configuredRate) {
      throw new BadRequestException('Missing GST_RATE additional setting');
    }

    const parsedRate = Number(configuredRate);
    if (!Number.isFinite(parsedRate)) {
      throw new BadRequestException('GST_RATE additional setting must be numeric');
    }

    return parsedRate;
  }

  private async runGstPreview(body: Record<string, any>): Promise<Record<string, any>> {
    const transactionPayload = body.transaction ?? body;
    const previewRows = await this.transactionRepository.query(
      `SELECT public.calculate_transaction_gst_preview($1::jsonb) AS preview`,
      [JSON.stringify(transactionPayload)],
    );

    const preview = previewRows?.[0]?.preview ?? previewRows?.[0]?.calculate_transaction_gst_preview ?? null;
    return typeof preview === 'string' ? JSON.parse(preview) : preview ?? {};
  }

  async previewTransactionTax(body: Record<string, any>): Promise<Record<string, any>> {
    return this.runGstPreview(body);
  }

  private resolvePaymentMethod(value: unknown): TransactionPaymentMethod {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === TransactionPaymentMethod.CASH) {
      return TransactionPaymentMethod.CASH;
    }

    if (normalized === TransactionPaymentMethod.CHEQUE) {
      return TransactionPaymentMethod.CHEQUE;
    }

    throw new BadRequestException('Payment mode must be CASH or CHEQUE');
  }

  private getFileIndex(fieldname: string) {
    const match = fieldname.match(/^files\[(\d+)\]$/);
    return match ? Number(match[1]) : -1;
  }

  private getSnapshotString(
    snapshot: Record<string, unknown> | null | undefined,
    key: string,
  ): string | null {
    const value = snapshot?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async isRequesterAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, isAdmin: true },
    });

    return user?.isAdmin === true;
  }

  private async canAccessTransaction(
    transaction: Transaction,
    userId: string | null | undefined,
    activeBranchId: string | null | undefined,
  ): Promise<boolean> {
    if (await this.isRequesterAdmin(userId)) {
      return true;
    }

    if (!activeBranchId) {
      return false;
    }

    return transaction.branchId === activeBranchId;
  }

  private async generateTransactionNumber(
    slug: string | null,
    branchSnapshot: Record<string, unknown> | null | undefined,
  ): Promise<string> {
    if (!slug) {
      throw new BadRequestException('Transaction slug is required to generate transaction number');
    }

    const branchCode =
      this.getSnapshotString(branchSnapshot, 'code') ??
      this.getSnapshotString(branchSnapshot, 'branchCode');

    if (!branchCode) {
      throw new BadRequestException('Branch code is required to generate transaction number');
    }

    return this.additionalSettingService.reserveTransactionNumber(
      slug,
      branchCode,
      new Date(),
    );
  }

  async getNextTransactionNumber(
    slug: string,
    branchId: string,
  ): Promise<{ nextNumber: string }> {
    if (!branchId) {
      throw new BadRequestException('Branch is required to generate transaction number');
    }

    if (!slug) {
      throw new BadRequestException('Transaction slug is required to generate transaction number');
    }

    const branchSnapshot = await loadEntitySnapshot(
      this.branchRepository,
      branchId,
    );
    if (!branchSnapshot) {
      throw new NotFoundException(`Branch with id ${branchId} not found`);
    }

    const branchCode =
      this.getSnapshotString(branchSnapshot, 'code') ??
      this.getSnapshotString(branchSnapshot, 'branchCode');

    if (!branchCode) {
      throw new BadRequestException('Branch code is required to generate transaction number');
    }

    return this.additionalSettingService.getTransactionNumberPreview(
      slug,
      branchCode,
      new Date(),
    );
  }

  private async hydratePartyProfileSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.partyProfileId) {
      return transaction;
    }

    if (transaction.partyProfileSnapshot) {
      return transaction;
    }

    const partyProfileSnapshot = await loadEntitySnapshot(
      this.partyProfileRepository,
      transaction.partyProfileId,
    );

    if (!partyProfileSnapshot) {
      return transaction;
    }

    transaction.partyProfileSnapshot = partyProfileSnapshot as TransactionReferenceSnapshotValue;

    return transaction;
  }

  private async hydrateAgentProfileSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.agentProfileId) {
      return transaction;
    }

    if (transaction.agentProfileSnapshot) {
      return transaction;
    }

    const agentProfileSnapshot = await loadEntitySnapshot(
      this.partyProfileRepository,
      transaction.agentProfileId,
    );

    if (!agentProfileSnapshot) {
      return transaction;
    }

    transaction.agentProfileSnapshot = agentProfileSnapshot as TransactionReferenceSnapshotValue;

    return transaction;
  }

  private async hydrateCounterSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.counterId) {
      return transaction;
    }

    if (transaction.counterSnapshot) {
      return transaction;
    }

    const counterSnapshot = await loadEntitySnapshot(
      this.counterRepository,
      transaction.counterId,
    );

    if (!counterSnapshot) {
      return transaction;
    }

    transaction.counterSnapshot = counterSnapshot as TransactionReferenceSnapshotValue;

    return transaction;
  }

  async getTransactions(
    slug?: string,
    branchId?: string,
    search?: string,
    status?: TransactionStatus,
    partyProfileId?: string,
    transactionType?: TransactionType,
  ): Promise<Transaction[]> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.isLatest = true');

    if (slug) {
      query.andWhere('transaction.slug = :slug', { slug });
    }

    if (branchId) {
      query.andWhere('transaction.branchId = :branchId', { branchId });
    }

    if (status) {
      query.andWhere('transaction.status = :status', { status });
    }

    if (partyProfileId) {
      query.andWhere('transaction.partyProfileId = :partyProfileId', { partyProfileId });
    }

    if (transactionType) {
      query.andWhere('transaction.transactionType = :transactionType', { transactionType });
    }

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      query.andWhere('transaction.number ILIKE :search', {
        search: `%${trimmedSearch}%`,
      });
    }

    query.orderBy('transaction.createdAt', 'DESC');
    const transactions = await query.getMany();
    const partyProfileIds = [
      ...new Set(
        transactions
          .filter(transaction => !transaction.partyProfileSnapshot)
          .map(transaction => transaction.partyProfileId),
      ),
    ];

    if (!partyProfileIds.length) {
      return transactions;
    }

    const partyProfiles = await Promise.all(
      partyProfileIds.map(async id => [id, await loadEntitySnapshot(this.partyProfileRepository, id)] as const),
    );
    const partyProfileById = new Map(partyProfiles);

    return transactions.map(transaction => {
      if (transaction.partyProfileSnapshot) {
        return transaction;
      }

      const partyProfile = partyProfileById.get(transaction.partyProfileId);
      if (!partyProfile) {
        return transaction;
      }

      return {
        ...transaction,
        partyProfileSnapshot: partyProfile,
      } as Transaction;
    }) as Transaction[];
  }

  async getQuantityAvailability(
    branchId: string,
    currencyId: string,
    productId: string,
    excludeTransactionId?: string,
  ): Promise<{
    branchId: string;
    currencyId: string;
    productId: string;
    purchasedQuantity: string;
    soldQuantity: string;
    availableQuantity: string;
  }> {
    if (!branchId) {
      throw new BadRequestException('Branch is required');
    }

    if (!currencyId) {
      throw new BadRequestException('Currency is required');
    }

    if (!productId) {
      throw new BadRequestException('Product is required');
    }

    const qb = this.transactionItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.transaction', 'tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.transaction_type = :purchaseType THEN item.quantity ELSE 0 END), 0)`,
        'purchasedQuantity',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN tx.transaction_type = :saleType THEN item.quantity ELSE 0 END), 0)`,
        'soldQuantity',
      )
      .where('tx.isLatest = true')
      .andWhere('tx.status = :approvedStatus', {
        approvedStatus: TransactionStatus.APPROVED,
      })
      .andWhere('tx.branchId = :branchId', { branchId })
      .andWhere('item.currencyId = :currencyId', { currencyId })
      .andWhere('item.productId = :productId', { productId })
      .setParameters({
        purchaseType: TransactionType.PURCHASE,
        saleType: TransactionType.SALE,
      });

    if (excludeTransactionId) {
      qb.andWhere('tx.id <> :excludeTransactionId', { excludeTransactionId });
    }

    const raw = await qb.getRawOne<{
      purchasedQuantity?: string;
      soldQuantity?: string;
    }>();

    const purchasedQuantity = String(raw?.purchasedQuantity ?? '0');
    const soldQuantity = String(raw?.soldQuantity ?? '0');
    const availableQuantity = (
      Number(purchasedQuantity || 0) - Number(soldQuantity || 0)
    ).toString();

    return {
      branchId,
      currencyId,
      productId,
      purchasedQuantity,
      soldQuantity,
      availableQuantity,
    };
  }

  async requestAccountPostingRebuild(
    transactionId: string,
    performedById: string | null,
  ): Promise<{ message: string }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      select: { id: true, createdBy: true, updatedBy: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with id ${transactionId} not found`);
    }

    const actorId = performedById ?? transaction.updatedBy ?? transaction.createdBy;
    if (!actorId) {
      throw new BadRequestException('Unable to determine the actor for rebuild request');
    }

    await this.transactionEventRepository.manager.transaction(async manager => {
      await manager.getRepository(TransactionEvent).delete({
        transactionId,
        eventType: TransactionEventType.ACCOUNT_POSTINGS_REBUILD,
        status: In([
          TransactionEventStatus.PENDING,
          TransactionEventStatus.PROCESSING,
        ]),
      });

      await manager.getRepository(TransactionEvent).save(
        manager.getRepository(TransactionEvent).create({
          transactionId,
          eventType: TransactionEventType.ACCOUNT_POSTINGS_REBUILD,
          payload: {
            transactionId,
            source: 'manual',
          },
          status: TransactionEventStatus.PENDING,
          attemptCount: 0,
          availableAt: new Date(),
          processedAt: null,
          errorMessage: null,
          lockedAt: null,
          lockedById: null,
          createdBy: actorId,
          updatedBy: actorId,
        }),
      );
    });

    return { message: 'Account posting rebuild queued successfully' };
  }

  async createDraft(
    body: Record<string, any>,
    files: UploadedDraftFile[],
    performedById: string | null,
    activeBranchId: string | null = null,
    activeCounterId: string | null = null,
  ): Promise<Transaction> {
    if (!performedById) {
      throw new BadRequestException('User session not found');
    }

    const transactionPayload = this.parseJsonField<Record<string, any>>(
      body.transaction,
      {},
    );
    const attachments = this.parseJsonField<
      Array<{ documentProfileId: string; fileName?: string }>
    >(body.attachments, []);

    const resolvedBranchId = activeBranchId || '';
    const resolvedCounterId = activeCounterId || '';

    if (!resolvedBranchId || !resolvedCounterId || !transactionPayload.partyProfileId) {
      throw new BadRequestException('Branch, counter, and party profile are required');
    }

    const filesByIndex = new Map<number, UploadedDraftFile>();
    for (const file of files ?? []) {
      const index = this.getFileIndex(file.fieldname);
      if (index >= 0) {
        filesByIndex.set(index, file);
      }
    }

    const shouldRequireApproval = Boolean(transactionPayload.requiresApproval);
    const transactionStatus = shouldRequireApproval
      ? TransactionStatus.DRAFT
      : TransactionStatus.APPROVED;
    const now = new Date();
    const currentCompany = await this.companyService.getCurrentCompany(now);
    if (!currentCompany) {
      throw new BadRequestException('Current company not found');
    }

    const currentCompanySnapshot = await this.companyService.getCurrentCompanySnapshot(now);
    if (!currentCompanySnapshot) {
      throw new BadRequestException('Current company snapshot not found');
    }

    const gstRatePercent = await this.resolveGstRatePercent();

    const selectedCounter = await this.counterRepository.findOne({
      where: { id: resolvedCounterId },
      relations: ['branch'],
    });

    if (!selectedCounter) {
      throw new NotFoundException(`Counter with id ${resolvedCounterId} not found`);
    }

    if (selectedCounter.branch?.id && selectedCounter.branch.id !== resolvedBranchId) {
      throw new BadRequestException('Selected counter does not belong to the selected branch');
    }

    const branchSnapshot = await loadEntitySnapshot(
      this.branchRepository,
      String(resolvedBranchId),
    );
    if (!branchSnapshot) {
      throw new NotFoundException(
        `Branch with id ${resolvedBranchId} not found`,
      );
    }

    const generatedNumber = shouldRequireApproval
      ? null
      : await this.generateTransactionNumber(
          String(transactionPayload.slug ?? ''),
          branchSnapshot,
        );

    const partyProfileSnapshot = await loadEntitySnapshot(
      this.partyProfileRepository,
      String(transactionPayload.partyProfileId),
    );
    if (!partyProfileSnapshot) {
      throw new NotFoundException(
        `Party profile with id ${transactionPayload.partyProfileId} not found`,
      );
    }

    const agentProfileSnapshot = transactionPayload.agentProfileId
      ? await loadEntitySnapshot(
          this.partyProfileRepository,
          String(transactionPayload.agentProfileId),
        )
      : null;
    if (transactionPayload.agentProfileId && !agentProfileSnapshot) {
      throw new NotFoundException(
        `Agent profile with id ${transactionPayload.agentProfileId} not found`,
      );
    }

    const manualBookPageSnapshot = transactionPayload.manualBookPageId
      ? await loadEntitySnapshot(
          this.manualBookPageTrackingRepository,
          String(transactionPayload.manualBookPageId),
        )
      : null;
    if (transactionPayload.manualBookPageId && !manualBookPageSnapshot) {
      throw new NotFoundException(
        `Manual book page with id ${transactionPayload.manualBookPageId} not found`,
      );
    }

    if (!resolvedCounterId) {
      throw new BadRequestException('Counter is required');
    }

    const counterSnapshot = await loadEntitySnapshot(
      this.counterRepository,
      String(resolvedCounterId),
    );
    if (!counterSnapshot) {
      throw new NotFoundException(
        `Counter with id ${resolvedCounterId} not found`,
      );
    }

    const purposeId = String(transactionPayload.purposeId ?? '').trim() || null;
    const purposeSnapshot = purposeId
      ? ((await loadEntitySnapshot(
          this.selectOptionRepository,
          purposeId,
        )) as TransactionReferenceSnapshotValue)
      : null;
    if (purposeId && !purposeSnapshot) {
      throw new NotFoundException(
        `Purpose option with id ${purposeId} not found`,
      );
    }

    const passengerPayload = transactionPayload.passenger ?? null;
    let passengerId: string | null = null;
    let passengerSnapshot: TransactionPassengerSnapshotValue = null;

    if (passengerPayload) {
      const passengerLookup = [
        passengerPayload.corporatePanNumber
          ? { corporatePanNumber: String(passengerPayload.corporatePanNumber).trim() }
          : null,
        passengerPayload.panNumber
          ? { panNumber: String(passengerPayload.panNumber).trim() }
          : null,
        passengerPayload.passportNumber
          ? { passportNumber: String(passengerPayload.passportNumber).trim() }
          : null,
      ].filter(Boolean) as Array<Record<string, string>>;

      const existingPassenger = passengerLookup.length
        ? await this.passengerRepository.findOne({ where: passengerLookup as any })
        : null;

      const residentStatusOption = passengerPayload.residentStatus
        ? await this.selectOptionRepository.findOne({
            where: {
              code: 'RESIDENTSTATUS',
              value: String(passengerPayload.residentStatus).trim(),
            },
          })
        : null;

      const savedPassenger = await this.passengerRepository.save(
        this.passengerRepository.create({
          id: existingPassenger?.id ?? undefined,
          partyProfileId: String(transactionPayload.partyProfileId),
          entityType: passengerPayload.entityType,
          nationalityType: passengerPayload.nationalityType,
          countryId: String(passengerPayload.countryId),
          residentStatusId: residentStatusOption?.id ?? null,
          locationId: passengerPayload.locationId ?? null,
          email: passengerPayload.email ?? null,
          contactNo: passengerPayload.contactNo ?? null,
          panNumber: passengerPayload.panNumber ?? null,
          panHolderName: passengerPayload.panHolderName ?? null,
          panDob: passengerPayload.panDob ?? null,
          panHolderRelationType: passengerPayload.panHolderRelationType ?? null,
          paidByPanNumber: passengerPayload.paidByPanNumber ?? null,
          paidByPanHolderName: passengerPayload.paidByPanHolderName ?? null,
          paidByPanDob: passengerPayload.paidByPanDob ?? null,
          corporatePanNumber: passengerPayload.corporatePanNumber ?? null,
          corporatePanHolderName: passengerPayload.corporatePanHolderName ?? null,
          corporatePanDob: passengerPayload.corporatePanDob ?? null,
          corporatePanHolderRelationType:
            passengerPayload.corporatePanHolderRelationType ?? null,
          gstStateId: passengerPayload.gstStateId ?? null,
          gstNumber: passengerPayload.gstNumber ?? null,
          address1: passengerPayload.address1 ?? null,
          address2: passengerPayload.address2 ?? null,
          city: passengerPayload.city ?? null,
          stateId: passengerPayload.stateId ?? null,
          passportNumber: passengerPayload.passportNumber ?? null,
          passportIssueAt: passengerPayload.passportIssueAt ?? null,
          passportIssueDate: passengerPayload.passportIssueDate ?? null,
          passportExpiryDate: passengerPayload.passportExpiryDate ?? null,
          arrivalDate: passengerPayload.arrivalDate ?? null,
          isPep: Boolean(passengerPayload.isPep),
          remarks: null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );

      passengerId = savedPassenger.id;
      passengerSnapshot = (await loadEntitySnapshot(
        this.passengerRepository,
        savedPassenger.id,
      )) as TransactionPassengerSnapshotValue;
    }

    const transaction = await this.transactionRepository.save(
      this.transactionRepository.create({
        rootTransactionId: transactionPayload.rootTransactionId ?? null,
        revisionNo: Number(transactionPayload.revisionNo ?? 1) || 1,
        number: generatedNumber,
        slug: transactionPayload.slug ?? null,
        branchId: String(resolvedBranchId),
        branchSnapshot,
        counterId: String(resolvedCounterId),
        counterSnapshot,
        companyId: currentCompany.id,
        companySnapshot: currentCompanySnapshot,
        partyProfileId: String(transactionPayload.partyProfileId),
        partyProfileSnapshot,
        purposeId,
        purposeSnapshot,
        passengerId,
        passengerSnapshot,
        agentProfileId: transactionPayload.agentProfileId ?? null,
        agentProfileSnapshot,
        manualBookPageId: transactionPayload.manualBookPageId ?? null,
        manualBookPageSnapshot,
        transactionType: transactionPayload.transactionType,
        tradeMode: transactionPayload.tradeMode,
        status: transactionStatus,
        remarks: transactionPayload.remarks ?? null,
        submittedAt: shouldRequireApproval ? now : now,
        approvedAt: shouldRequireApproval ? null : now,
        rejectedAt: null,
        approvedById: shouldRequireApproval ? null : performedById,
        rejectedById: null,
        approvalRemarks: null,
        rejectionReason: null,
        isLatest: true,
        taxRatePercent: roundMoney(gstRatePercent),
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    const passengerOtherDocumentRows = Array.isArray(passengerPayload?.otherDocuments)
      ? passengerPayload.otherDocuments
      : [];
    for (let index = 0; index < passengerOtherDocumentRows.length; index += 1) {
      const row = passengerOtherDocumentRows[index];
      const rawFile = String(row.documentFile ?? '').trim();
      const hasDataUrlPrefix = rawFile.startsWith('data:');
      const fileContent = rawFile
        ? Buffer.from(
            hasDataUrlPrefix ? rawFile.split(',')[1] ?? '' : rawFile,
            'base64',
          )
        : null;
      const mimeType = hasDataUrlPrefix ? rawFile.slice(5, rawFile.indexOf(';')) : null;

      await this.transactionPassengerOtherDocumentRepository.save(
        this.transactionPassengerOtherDocumentRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          documentType: row.documentType,
          documentNumber: String(row.documentNumber),
          validTill: row.validTill ?? null,
          issueAt: row.issueAt ?? null,
          issueDate: row.issueDate ?? null,
          expiryDate: row.expiryDate ?? null,
          fileName: rawFile ? `${row.documentType || 'document'}-${index + 1}` : null,
          originalFileName: rawFile ? `${row.documentType || 'document'}-${index + 1}` : null,
          mimeType,
          fileSize: fileContent ? String(fileContent.length) : null,
          storageKey: null,
          storagePath: null,
          storageUrl: null,
          content: fileContent,
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
    }

    const currencySnapshots = new Map<string, Record<string, unknown>>();
    const productSnapshots = new Map<string, Record<string, unknown>>();
    const accountSnapshots = new Map<string, Record<string, unknown>>();
    const documentProfileSnapshots = new Map<string, Record<string, unknown>>();
    const resolveSnapshot = async (
      cache: Map<string, Record<string, unknown>>,
      repository: Repository<any>,
      id: string,
      label: string,
    ) => {
      if (!cache.has(id)) {
        const snapshot = await loadEntitySnapshot(repository, id);
        if (!snapshot) {
          throw new NotFoundException(`${label} with id ${id} not found`);
        }
        cache.set(id, snapshot);
      }
      return cache.get(id)!;
    };

    const resolveCurrency = async (currencyId: string) => {
      return resolveSnapshot(
        currencySnapshots,
        this.currencyRepository,
        currencyId,
        'Currency',
      );
    };

    const resolveProduct = async (productId: string) => {
      return resolveSnapshot(
        productSnapshots,
        this.productRepository,
        productId,
        'Product',
      );
    };

    const resolveProductEntity = async (productId: string) => {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: [
          'bulkPurAc',
          'purchaseAc',
          'bulkSaleAc',
          'saleAc',
          'bulkProficAc',
          'profitAc',
        ],
      });

      if (!product) {
        throw new NotFoundException(`Product with id ${productId} not found`);
      }

      return product;
    };

    const resolveAccount = async (accountId: string) => {
      return resolveSnapshot(
        accountSnapshots,
        this.accountProfileRepository,
        accountId,
        'Account',
      );
    };

    const resolveDocumentProfile = async (documentProfileId: string) => {
      return resolveSnapshot(
        documentProfileSnapshots,
        this.documentProfileRepository,
        documentProfileId,
        'Document profile',
      );
    };

    const itemRows = Array.isArray(transactionPayload.items)
      ? transactionPayload.items
      : [];
    for (let index = 0; index < itemRows.length; index += 1) {
      const row = itemRows[index];
      const currency = await resolveCurrency(String(row.currencyId));
      const product = await resolveProduct(String(row.productId));
      const productEntity = await resolveProductEntity(String(row.productId));
      const itemAccount =
        resolveProductTransactionAccount(
          productEntity,
          transactionPayload.transactionType,
          transactionPayload.tradeMode,
          transactionPayload.transactionType === TransactionType.SALE
            ? 'sale'
            : 'purchase',
        );

      if (!itemAccount) {
        throw new NotFoundException(
          `Product account is not configured for product ${row.productId}`,
        );
      }

      const accountSnapshot = await loadEntitySnapshot(
        this.accountProfileRepository,
        itemAccount.id,
      );

      await this.transactionItemRepository.save(
        this.transactionItemRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          currencyId: String(currency.id),
          productId: String(product.id),
          accountId: itemAccount.id,
          accountSnapshot,
          currencyRateId: row.currencyRateId ?? null,
          productCurrencyRateId: row.productCurrencyRateId ?? null,
          quantity: String(row.quantity),
          per: row.per ?? null,
          rate: String(row.rate),
          commission: row.commission ?? null,
          currencySnapshot: currency as TransactionReferenceSnapshotValue,
          productSnapshot: product as TransactionReferenceSnapshotValue,
          currencyRateSnapshot: row.currencyRateSnapshot ?? null,
          productCurrencyRateSnapshot: row.productCurrencyRateSnapshot ?? null,
          pricingRuleSnapshot: row.pricingRuleSnapshot ?? null,
          commissionSnapshot: row.commissionSnapshot ?? null,
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
    }

    const documentRows = Array.isArray(transactionPayload.documents)
      ? transactionPayload.documents
      : [];
    for (let index = 0; index < documentRows.length; index += 1) {
      const row = documentRows[index];
      const attachment = attachments[index];
      const upload = filesByIndex.get(index);
      const documentProfile = await resolveDocumentProfile(String(row.documentProfileId));

      let storageKey: string | null = null;
      let storageUrl: string | null = null;
      let content: Buffer | null = null;
      let fileName: string | null = attachment?.fileName ?? upload?.originalname ?? null;
      let originalFileName: string | null = upload?.originalname ?? null;
      let mimeType: string | null = upload?.mimetype ?? null;
      let fileSize: string | null = upload?.size != null ? String(upload.size) : null;

      if (upload?.buffer) {
        const safeName = upload.originalname.replace(/[^\w.\-]+/g, '_');
        storageKey = `transactions/${transaction.id}/documents/${index + 1}-${documentProfile.id}-${safeName}`;
        try {
          storageUrl = await this.storageService.store(storageKey, upload.buffer);
        } catch (error) {
          console.warn(
            '[TransactionsService] Falling back to database storage for transaction document upload',
            {
              transactionId: transaction.id,
              documentProfileId: documentProfile.id,
              storageKey,
              reason: error instanceof Error ? error.message : error,
            },
          );
          content = upload.buffer;
          storageKey = null;
          storageUrl = null;
        }
      }

      await this.transactionDocumentRepository.save(
        this.transactionDocumentRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          documentProfileId: String(documentProfile.id),
          documentProfileSnapshot: documentProfile as TransactionReferenceSnapshotValue,
          status: row.status ?? TransactionDocumentStatus.ATTACHED,
          fileName,
          originalFileName,
          mimeType,
          fileSize,
          storageKey,
          storagePath: storageKey,
          storageUrl,
          content,
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
    }

    const additionalChargeRows = Array.isArray(transactionPayload.additionalCharges)
      ? transactionPayload.additionalCharges
      : [];
    for (let index = 0; index < additionalChargeRows.length; index += 1) {
      const row = additionalChargeRows[index];
      const account = await resolveAccount(String(row.accountId));
      await this.transactionAdditionalChargeRepository.save(
        this.transactionAdditionalChargeRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          accountId: String(account.id),
          accountSnapshot: account as TransactionReferenceSnapshotValue,
          amount: roundMoney(this.toNumber(row.amount)),
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
    }

    const refreshedTransaction = await this.transactionRepository.findOne({
      where: { id: transaction.id },
    });
    if (!refreshedTransaction) {
      throw new BadRequestException('Failed to calculate transaction tax');
    }

    const paymentRows = Array.isArray(transactionPayload.payments)
      ? transactionPayload.payments
      : [];
    const payableTotal = String(refreshedTransaction.finalAmount ?? '0');
    const payableTotalAmount = Number(payableTotal || 0);
    if (payableTotalAmount > 0 && paymentRows.length === 0) {
      throw new BadRequestException('At least one payment row is required');
    }

    const paymentMethods = paymentRows.map(row =>
      this.resolvePaymentMethod(row.paymentMethod),
    );
    if (new Set(paymentMethods).size > 1) {
      throw new BadRequestException(
        'All payment rows must use the same payment method',
      );
    }

    const uniformPaymentMethod = paymentMethods[0] ?? null;
    const cashControlAccountId = await this.additionalSettingService.getSettingTextValue(
      'TRANSACTION_ACCOUNTING',
      'CASH_CONTROL_ACCOUNT',
    );
    if (uniformPaymentMethod === TransactionPaymentMethod.CASH && !cashControlAccountId) {
      throw new BadRequestException(
        'Missing CASH_CONTROL_ACCOUNT additional setting',
      );
    }

    const paymentDirection =
      transactionPayload.transactionType === TransactionType.SALE
        ? TransactionPaymentDirection.RECEIPT
        : TransactionPaymentDirection.PAYMENT;
    let cashTotal = 0;
    let chequeTotal = 0;
    for (let index = 0; index < paymentRows.length; index += 1) {
      const row = paymentRows[index];
      const account = await resolveAccount(String(row.accountId));
      const paymentMethod = this.resolvePaymentMethod(row.paymentMethod);
      const amount = this.toNumber(row.amount);
      if (amount <= 0) {
        throw new BadRequestException('Payment amount must be greater than zero');
      }

      if (paymentMethod === TransactionPaymentMethod.CASH) {
        if (cashControlAccountId && String(account.id) !== cashControlAccountId) {
          throw new BadRequestException(
            'Cash payments must use the configured cash control account',
          );
        }
        cashTotal += amount;
      } else {
        chequeTotal += amount;
      }

      if (
        paymentMethod === TransactionPaymentMethod.CHEQUE &&
        !String(row.referenceNumber ?? '').trim()
      ) {
        throw new BadRequestException('Cheque reference number is required');
      }

      if (
        paymentMethod === TransactionPaymentMethod.CHEQUE &&
        transactionPayload.transactionType === TransactionType.SALE &&
        row.chequePageId
      ) {
        throw new BadRequestException(
          'Cheque page lookup is not allowed for sale cheque payments',
        );
      }

      if (
        paymentMethod === TransactionPaymentMethod.CHEQUE &&
        transactionPayload.transactionType === TransactionType.PURCHASE &&
        !row.chequePageId
      ) {
        throw new BadRequestException('Cheque page is required for purchase payments');
      }

      const chequePageSnapshot = row.chequePageId
        ? ((await loadEntitySnapshot(
            this.chequeBookPageTrackingRepository,
            String(row.chequePageId),
          )) as TransactionReferenceSnapshotValue)
        : null;

      if (row.chequePageId && !chequePageSnapshot) {
        throw new NotFoundException(
          `Cheque page with id ${row.chequePageId} not found`,
        );
      }

      await this.transactionPaymentRepository.save(
        this.transactionPaymentRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          accountId: String(account.id),
          accountSnapshot: account as TransactionReferenceSnapshotValue,
          chequePageId: row.chequePageId ?? null,
          chequePageSnapshot,
          paymentMethod,
          paymentDirection,
          referenceNumber: row.referenceNumber ?? null,
          referenceDate: row.referenceDate ?? null,
          branchName: row.branchName ?? null,
          drawnOn: row.drawnOn ?? null,
          amount: String(row.amount),
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
    }

    const totalPaid = Number((cashTotal + chequeTotal).toFixed(2));
    if (Number(payableTotal.toString()) !== totalPaid) {
      throw new BadRequestException(
        `Payment total ${totalPaid.toFixed(2)} must match payable total ${payableTotal}`,
      );
    }

    transaction.byCash = cashTotal.toFixed(2);
    transaction.byCheque = chequeTotal.toFixed(2);
    transaction.updatedBy = performedById;
    await this.transactionRepository.save(transaction);

    await this.transactionLogRepository.save(
      this.transactionLogRepository.create({
        transactionId: transaction.id,
        action: TransactionLogAction.CREATE,
        message: shouldRequireApproval
          ? 'Transaction draft created'
          : 'Transaction approved on creation',
        metadata: {
          status: transactionStatus,
          requiresApproval: shouldRequireApproval,
        },
        performedById,
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    const partyProfileForEmail = await this.partyProfileRepository.findOne({
      where: { id: transaction.partyProfileId },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
      },
    });

    if (partyProfileForEmail?.email) {
      try {
        const transactionLabel = transaction.number || 'Transaction';
        await this.mailService.sendEmail({
          to: partyProfileForEmail.email,
          subject: `${transactionLabel} - Transaction Created`,
          text: `Your transaction ${transactionLabel} has been created successfully. You can print the original copy from the transaction documents screen.`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <p>Your transaction <strong>${transactionLabel}</strong> has been created successfully.</p>
              <p>You can print the original copy from the transaction documents screen.</p>
            </div>
          `,
        });
      } catch (error) {
        console.warn('[TransactionsService] Failed to send transaction created email', {
          transactionId: transaction.id,
          partyProfileId: partyProfileForEmail.id,
          email: partyProfileForEmail.email,
          reason: error instanceof Error ? error.message : error,
        });
      }
    }

    const savedTransaction = await this.transactionRepository.findOne({
      where: { id: transaction.id },
    }) as Transaction;

    await this.hydrateCounterSnapshot(savedTransaction);

    return savedTransaction;
  }

  async approveTransaction(
    transactionId: string,
    performedById: string | null,
    approvalRemarks: string | null = null,
    activeCounterId: string | null = null,
  ): Promise<Transaction> {
    if (!performedById) {
      throw new BadRequestException('User session not found');
    }

    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, isLatest: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with id ${transactionId} not found`);
    }

    if (transaction.status !== TransactionStatus.DRAFT) {
      throw new BadRequestException('Only draft transactions can be approved');
    }

    if (!transaction.number) {
      transaction.number = await this.generateTransactionNumber(
        transaction.slug,
        transaction.branchSnapshot as Record<string, unknown> | null | undefined,
      );
    }

    if (!transaction.counterId) {
      if (!activeCounterId) {
        throw new BadRequestException('Counter is required');
      }

      const counterSnapshot = await loadEntitySnapshot(
        this.counterRepository,
        activeCounterId,
      );

      if (!counterSnapshot) {
        throw new NotFoundException(`Counter with id ${activeCounterId} not found`);
      }

      transaction.counterId = activeCounterId;
      transaction.counterSnapshot = counterSnapshot as TransactionReferenceSnapshotValue;
    }

    transaction.status = TransactionStatus.APPROVED;
    transaction.submittedAt = transaction.submittedAt ?? new Date();
    transaction.approvedAt = new Date();
    transaction.approvedById = performedById;
    transaction.approvalRemarks = approvalRemarks;
    transaction.updatedBy = performedById;

    const saved = await this.transactionRepository.save(transaction);

    await this.transactionLogRepository.save(
      this.transactionLogRepository.create({
        transactionId: saved.id,
        action: TransactionLogAction.APPROVE,
        message: 'Transaction approved',
        metadata: {
          status: TransactionStatus.APPROVED,
          approvalRemarks,
        },
        performedById,
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    const approvedTransaction = await this.transactionRepository.findOne({
      where: { id: saved.id },
    }) as Transaction;

    await this.hydrateCounterSnapshot(approvedTransaction);

    return approvedTransaction;
  }

  async getTransactionById(
    id: string,
    userId?: string | null,
    activeBranchId?: string | null,
  ): Promise<Transaction | null> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: {
        items: true,
        documents: true,
        additionalCharges: true,
        payments: true,
        postings: true,
        logs: true,
      },
    });

    if (!transaction) {
      return null;
    }

    if (!(await this.canAccessTransaction(transaction, userId ?? null, activeBranchId ?? null))) {
      throw new NotFoundException('Transaction not found');
    }

    await this.hydratePartyProfileSnapshot(transaction);
    await this.hydrateAgentProfileSnapshot(transaction);
    await this.hydrateCounterSnapshot(transaction);

    return transaction;
  }

  async downloadDocument(
    transactionId: string,
    documentId: string,
    userId?: string | null,
    activeBranchId?: string | null,
  ): Promise<
    | { redirectUrl: string; fileName: string; mimeType: string }
    | { file: StreamableFile; fileName: string; mimeType: string }
  > {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      select: { id: true, branchId: true },
    });

    if (!transaction || !(await this.canAccessTransaction(transaction as Transaction, userId ?? null, activeBranchId ?? null))) {
      throw new NotFoundException('Transaction not found');
    }

    const document = await this.transactionDocumentRepository.findOne({
      where: {
        id: documentId,
        transactionId,
      },
    });

    if (!document) {
      throw new NotFoundException('Transaction document not found');
    }

    const fileName =
      document.fileName || document.originalFileName || 'transaction-document';
    const mimeType = document.mimeType || 'application/octet-stream';

    if (document.storageUrl) {
      return {
        redirectUrl: document.storageUrl,
        fileName,
        mimeType,
      };
    }

    if (document.content) {
      return {
        file: new StreamableFile(document.content),
        fileName,
        mimeType,
      };
    }

    throw new NotFoundException('Transaction document file not available');
  }

  async recordPrint(
    transactionId: string,
    dto: RecordTransactionPrintDto,
    performedById: string | null,
    activeBranchId?: string | null,
  ): Promise<{ message: string; messageId?: string }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      select: { id: true, branchId: true },
    });

    if (!transaction || !(await this.canAccessTransaction(transaction as Transaction, performedById, activeBranchId ?? null))) {
      throw new NotFoundException('Transaction not found');
    }

    const existingPrintCount = await this.transactionLogRepository.count({
      where: {
        transactionId,
        action: TransactionLogAction.PRINT,
      },
    });
    const copyType =
      existingPrintCount === 0 ? 'CUSTOMER_COPY' : 'DUPLICATE_COPY';
    const message =
      copyType === 'DUPLICATE_COPY'
        ? 'Duplicate copy printed'
        : 'Original copy printed';
    let messageId: string | undefined;

    if (dto.sendEmail) {
      if (!dto.recipientEmail) {
        throw new BadRequestException('Recipient email is required to send the customer copy');
      }

      const sent = await this.mailService.sendEmail({
        to: dto.recipientEmail,
        subject: dto.subject || 'Buy From Print Copy',
        text: dto.text || 'Please find the requested transaction copy attached in the email body.',
        html: dto.html,
      });
      messageId = sent.messageId;
    }

    await this.transactionLogRepository.save(
      this.transactionLogRepository.create({
        transactionId,
        action: TransactionLogAction.PRINT,
        message,
        metadata: {
          copyType,
          requestedCopyType: dto.copyType ?? null,
          sendEmail: Boolean(dto.sendEmail),
          recipientEmail: dto.recipientEmail || null,
          subject: dto.subject || null,
          emailMessageId: messageId || null,
        },
        performedById,
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    return {
      message,
      messageId,
    };
  }
}
