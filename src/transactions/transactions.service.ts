import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { TransactionLog } from './entities/transaction-log.entity';
import { Transaction } from './entities/transaction.entity';
import { TransactionLogAction, TransactionDocumentStatus, TransactionStatus } from './transactions.enums';
import { RecordTransactionPrintDto } from './dto/record-transaction-print.dto';
import { TransactionItem } from './entities/transaction-item.entity';
import { TransactionDocument } from './entities/transaction-document.entity';
import { TransactionAdditionalCharge } from './entities/transaction-additional-charge.entity';
import { TransactionPayment } from './entities/transaction-payment.entity';
import { Currency } from '../currencies/currency.entity';
import { Product } from '../products/product.entity';
import { DocumentProfile } from '../document-profiles/document-profile.entity';
import { StorageService } from '../storage/storage.service';
import { TransactionReferenceSnapshotValue } from './types/transaction-snapshot.types';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { PartyProfile } from '../party-profiles/party-profile.entity';

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
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
  ) {}

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

  private getFileIndex(fieldname: string) {
    const match = fieldname.match(/^files\[(\d+)\]$/);
    return match ? Number(match[1]) : -1;
  }

  private toReferenceSnapshot(
    entity: { id: string; code?: string | null; name?: string | null },
  ): TransactionReferenceSnapshotValue {
    return {
      id: entity.id,
      code: entity.code ?? null,
      name: entity.name ?? null,
      label:
        entity.code && entity.name
          ? `${entity.code} - ${entity.name}`
          : entity.name ?? entity.code ?? entity.id,
    };
  }

  private async hydratePartyProfileSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.partyProfileId) {
      return transaction;
    }

    if (
      transaction.partyProfileSnapshot &&
      (transaction.partyProfileSnapshot.address1 ||
        transaction.partyProfileSnapshot.phoneNo ||
        transaction.partyProfileSnapshot.email ||
        transaction.partyProfileSnapshot.gstNo)
    ) {
      return transaction;
    }

    const partyProfile = await this.partyProfileRepository.findOne({
      where: { id: transaction.partyProfileId },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phoneNo: true,
        address1: true,
        address2: true,
        address3: true,
        city: true,
        pinCode: true,
        panNo: true,
        gstNo: true,
        gstStateId: true,
        stateId: true,
        contactName: true,
        applyTax: true,
        gstState: {
          id: true,
          name: true,
          code: true,
          gstStateCode: true,
        },
        state: {
          id: true,
          name: true,
          code: true,
          gstStateCode: true,
        },
      },
      relations: {
        gstState: true,
        state: true,
      },
    });

    if (!partyProfile) {
      return transaction;
    }

    transaction.partyProfileSnapshot = {
      ...this.toReferenceSnapshot({
        id: partyProfile.id,
        code: partyProfile.code,
        name: partyProfile.name,
      }),
      email: partyProfile.email ?? null,
      phoneNo: partyProfile.phoneNo ?? null,
      address1: partyProfile.address1 ?? null,
      address2: partyProfile.address2 ?? null,
      address3: partyProfile.address3 ?? null,
      city: partyProfile.city ?? null,
      pinCode: partyProfile.pinCode ?? null,
      panNo: partyProfile.panNo ?? null,
      gstNo: partyProfile.gstNo ?? null,
      gstStateId: partyProfile.gstStateId ?? null,
      gstStateName: partyProfile.gstState?.name ?? null,
      stateId: partyProfile.stateId ?? null,
      stateName: partyProfile.state?.name ?? null,
      contactName: partyProfile.contactName ?? null,
      applyTax: Boolean(partyProfile.applyTax),
    } as TransactionReferenceSnapshotValue;

    return transaction;
  }

  private async hydrateAgentProfileSnapshot(
    transaction: Transaction,
  ): Promise<Transaction> {
    if (!transaction.agentProfileId) {
      return transaction;
    }

    if (
      transaction.agentProfileSnapshot &&
      (transaction.agentProfileSnapshot.code ||
        transaction.agentProfileSnapshot.name)
    ) {
      return transaction;
    }

    const agentProfile = await this.partyProfileRepository.findOne({
      where: { id: transaction.agentProfileId },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!agentProfile) {
      return transaction;
    }

    transaction.agentProfileSnapshot = this.toReferenceSnapshot({
      id: agentProfile.id,
      code: agentProfile.code,
      name: agentProfile.name,
    });

    return transaction;
  }

  async getTransactions(
    slug?: string,
    branchId?: string,
    search?: string,
    status?: TransactionStatus,
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

    const partyProfiles = await this.partyProfileRepository.find({
      where: { id: In(partyProfileIds) },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phoneNo: true,
        address1: true,
        address2: true,
        address3: true,
        city: true,
        pinCode: true,
        panNo: true,
        gstNo: true,
        gstStateId: true,
        stateId: true,
        contactName: true,
        applyTax: true,
      },
      relations: {
        gstState: true,
        state: true,
      },
    });
    const partyProfileById = new Map(
      partyProfiles.map(profile => [profile.id, profile]),
    );

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
        partyProfileSnapshot: {
          ...this.toReferenceSnapshot({
            id: partyProfile.id,
            code: partyProfile.code,
            name: partyProfile.name,
          }),
          email: partyProfile.email ?? null,
          phoneNo: partyProfile.phoneNo ?? null,
          address1: partyProfile.address1 ?? null,
          address2: partyProfile.address2 ?? null,
          address3: partyProfile.address3 ?? null,
          city: partyProfile.city ?? null,
          pinCode: partyProfile.pinCode ?? null,
          panNo: partyProfile.panNo ?? null,
          gstNo: partyProfile.gstNo ?? null,
          gstStateId: partyProfile.gstStateId ?? null,
          gstStateName: partyProfile.gstState?.name ?? null,
          stateId: partyProfile.stateId ?? null,
          stateName: partyProfile.state?.name ?? null,
          contactName: partyProfile.contactName ?? null,
          applyTax: Boolean(partyProfile.applyTax),
        },
      };
    });
  }

  async createDraft(
    body: Record<string, any>,
    files: UploadedDraftFile[],
    performedById: string | null,
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

    if (!transactionPayload.number || !transactionPayload.branchId || !transactionPayload.partyProfileId) {
      throw new BadRequestException('Transaction number, branch, and party profile are required');
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

    const transaction = await this.transactionRepository.save(
      this.transactionRepository.create({
        rootTransactionId: transactionPayload.rootTransactionId ?? null,
        revisionNo: Number(transactionPayload.revisionNo ?? 1) || 1,
        number: String(transactionPayload.number),
        slug: transactionPayload.slug ?? null,
        branchId: String(transactionPayload.branchId),
        branchSnapshot: transactionPayload.branchSnapshot ?? null,
        partyProfileId: String(transactionPayload.partyProfileId),
        partyProfileSnapshot: transactionPayload.partyProfileSnapshot ?? null,
        agentProfileId: transactionPayload.agentProfileId ?? null,
        agentProfileSnapshot: transactionPayload.agentProfileSnapshot ?? null,
        manualBookPageId: transactionPayload.manualBookPageId ?? null,
        manualBookPageSnapshot: transactionPayload.manualBookPageSnapshot ?? null,
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
        createdBy: performedById,
        updatedBy: performedById,
      }),
    );

    const partyProfile = await this.partyProfileRepository.findOne({
      where: { id: transaction.partyProfileId },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (partyProfile) {
      transaction.partyProfileSnapshot = this.toReferenceSnapshot(partyProfile);
      await this.transactionRepository.save(transaction);
    }

    if (transaction.agentProfileId) {
      const agentProfile = await this.partyProfileRepository.findOne({
        where: { id: transaction.agentProfileId },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      if (agentProfile) {
        transaction.agentProfileSnapshot = this.toReferenceSnapshot(agentProfile);
        await this.transactionRepository.save(transaction);
      }
    }

    const currencyCodes = new Map<string, { id: string; currencyCode: string; currencyName: string | null }>();
    const productCodes = new Map<string, { id: string; productCode: string; productDescription: string | null }>();
    const accountIds = new Map<string, { id: string; code?: string | null; name?: string | null }>();
    const documentProfiles = new Map<string, { id: string; description?: string | null }>();

    const resolveCurrency = async (currencyId: string) => {
      if (!currencyCodes.has(currencyId)) {
        const currency = await this.currencyRepository.findOne({ where: { id: currencyId } });
        if (!currency) {
          throw new NotFoundException(`Currency with id ${currencyId} not found`);
        }
        currencyCodes.set(currencyId, {
          id: currency.id,
          currencyCode: currency.currencyCode,
          currencyName: currency.currencyName ?? null,
        });
      }
      return currencyCodes.get(currencyId)!;
    };

    const resolveProduct = async (productId: string) => {
      if (!productCodes.has(productId)) {
        const product = await this.productRepository.findOne({ where: { id: productId } });
        if (!product) {
          throw new NotFoundException(`Product with id ${productId} not found`);
        }
        productCodes.set(productId, {
          id: product.id,
          productCode: product.productCode,
          productDescription: product.productDescription ?? null,
        });
      }
      return productCodes.get(productId)!;
    };

    const resolveAccount = async (accountId: string) => {
      if (!accountIds.has(accountId)) {
        const account = await this.accountProfileRepository.findOne({ where: { id: accountId } });
        if (!account) {
          throw new NotFoundException(`Account with id ${accountId} not found`);
        }
        accountIds.set(accountId, {
          id: account.id,
          code: account.accountCode ?? null,
          name: account.accountName ?? null,
        });
      }
      return accountIds.get(accountId)!;
    };

    const resolveDocumentProfile = async (documentProfileId: string) => {
      if (!documentProfiles.has(documentProfileId)) {
        const documentProfile = await this.documentProfileRepository.findOne({
          where: { id: documentProfileId },
        });
        if (!documentProfile) {
          throw new NotFoundException(`Document profile with id ${documentProfileId} not found`);
        }
        documentProfiles.set(documentProfileId, {
          id: documentProfile.id,
          description: documentProfile.documentDescription ?? null,
        });
      }
      return documentProfiles.get(documentProfileId)!;
    };

    const itemRows = Array.isArray(transactionPayload.items)
      ? transactionPayload.items
      : [];
    for (let index = 0; index < itemRows.length; index += 1) {
      const row = itemRows[index];
      const currency = await resolveCurrency(String(row.currencyId));
      const product = await resolveProduct(String(row.productId));
      await this.transactionItemRepository.save(
        this.transactionItemRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          currencyId: currency.id,
          productId: product.id,
          currencyRateId: row.currencyRateId ?? null,
          productCurrencyRateId: row.productCurrencyRateId ?? null,
          quantity: String(row.quantity),
          per: row.per ?? null,
          rate: String(row.rate),
          commission: row.commission ?? null,
          currencySnapshot: {
            id: currency.id,
            code: currency.currencyCode,
            name: currency.currencyName,
            label: currency.currencyName ? `${currency.currencyCode} - ${currency.currencyName}` : currency.currencyCode,
          },
          productSnapshot: {
            id: product.id,
            code: product.productCode,
            name: product.productDescription,
            label: product.productDescription ? `${product.productCode} - ${product.productDescription}` : product.productCode,
          },
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
          documentProfileId: documentProfile.id,
          documentProfileSnapshot: {
            id: documentProfile.id,
            name: documentProfile.description ?? null,
          } as TransactionReferenceSnapshotValue,
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
          accountId: account.id,
          accountSnapshot: {
            id: account.id,
            code: account.code ?? null,
            name: account.name ?? null,
            label: account.name ?? account.code ?? account.id,
          },
          amount: String(row.amount),
          gstRate: row.gstRate ?? null,
          gstAmount: row.gstAmount ?? null,
          remarks: row.remarks ?? null,
          createdBy: performedById,
          updatedBy: performedById,
        }),
      );
    }

    const paymentRows = Array.isArray(transactionPayload.payments)
      ? transactionPayload.payments
      : [];
    for (let index = 0; index < paymentRows.length; index += 1) {
      const row = paymentRows[index];
      const account = await resolveAccount(String(row.accountId));
      await this.transactionPaymentRepository.save(
        this.transactionPaymentRepository.create({
          transactionId: transaction.id,
          transaction,
          lineNo: index + 1,
          accountId: account.id,
          accountSnapshot: {
            id: account.id,
            code: account.code ?? null,
            name: account.name ?? null,
            label: account.name ?? account.code ?? account.id,
          },
          chequePageId: row.chequePageId ?? null,
          chequePageSnapshot: row.chequePageSnapshot ?? null,
          paymentMethod: row.paymentMethod,
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
        await this.mailService.sendEmail({
          to: partyProfileForEmail.email,
          subject: `${transaction.number} - Transaction Created`,
          text: `Your transaction ${transaction.number} has been created successfully. You can print the original copy from the transaction documents screen.`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <p>Your transaction <strong>${transaction.number}</strong> has been created successfully.</p>
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

    return this.transactionRepository.findOne({
      where: { id: transaction.id },
    }) as Promise<Transaction>;
  }

  async approveTransaction(
    transactionId: string,
    performedById: string | null,
    approvalRemarks: string | null = null,
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

    return this.transactionRepository.findOne({
      where: { id: saved.id },
    }) as Promise<Transaction>;
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: {
        items: true,
        documents: true,
        additionalCharges: true,
        payments: true,
      },
    });

    if (!transaction) {
      return null;
    }

    await this.hydratePartyProfileSnapshot(transaction);
    await this.hydrateAgentProfileSnapshot(transaction);
    return transaction;
  }

  async downloadDocument(
    transactionId: string,
    documentId: string,
  ): Promise<
    | { redirectUrl: string; fileName: string; mimeType: string }
    | { file: StreamableFile; fileName: string; mimeType: string }
  > {
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
  ): Promise<{ message: string; messageId?: string }> {
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
