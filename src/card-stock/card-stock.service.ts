import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import { loadEntitySnapshot } from '../common/snapshot/entity-snapshot.util';
import { Branch } from '../branches/branch.entity';
import { Currency } from '../currencies/currency.entity';
import { PartyProfile, ClientType } from '../party-profiles/party-profile.entity';
import { WorkflowStatus } from '../common/enums/workflow-status.enum';
import { Product } from '../products/product.entity';
import { ProductCardIssuer } from '../products/entities/product-card-issuer.entity';
import { TransactionTypeProfileEnum } from '../transactions/transactions.enums';
import { DayEndStartProcessService } from '../day-end-start-process/day-end-start-process.service';
import { CardStockCard } from './entities/card-stock-card.entity';
import { CardStockReceipt } from './entities/card-stock-receipt.entity';
import { CardStockReceiptItem } from './entities/card-stock-receipt-item.entity';
import { CardStockReceiptStatus, CardStockCardStatus, CardStockReferenceType } from './card-stock.enums';
import { CreateCardStockReceiptDto } from './dto/card-stock-receipt.dto';
import { CardStockTransactionService } from './card-stock-transaction.service';
import { AuthenticatedSession } from '../auth/types/session-context';
import { SpreadsheetUploadService } from '../common/upload/spreadsheet-upload.service';
import { validateCardNumber } from './card-number.util';

const CARD_PRODUCT_CODE = 'CC';

@Injectable()
export class CardStockService {
  constructor(
    @InjectDataSource('database2') private readonly database2: DataSource,
    @InjectRepository(CardStockReceipt, 'database2') private readonly receiptRepository: Repository<CardStockReceipt>,
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Currency) private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCardIssuer) private readonly productIssuerRepository: Repository<ProductCardIssuer>,
    @InjectRepository(PartyProfile) private readonly partyProfileRepository: Repository<PartyProfile>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
    private readonly cardStockTransactionService: CardStockTransactionService,
    private readonly spreadsheetUploadService: SpreadsheetUploadService,
  ) {}

  async findAll(branchId?: string): Promise<CardStockReceipt[]> {
    const query = this.receiptRepository.createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.items', 'item')
      .leftJoinAndSelect('item.cards', 'card')
      .orderBy('receipt.receiptDate', 'DESC')
      .addOrderBy('receipt.createdAt', 'DESC');
    if (branchId) query.where('receipt.branchId = :branchId', { branchId });
    const receipts = await query.getMany();
    return this.withMaskedCards(receipts);
  }

  async findById(id: string, session?: AuthenticatedSession): Promise<CardStockReceipt> {
    const receipt = await this.receiptRepository.findOne({ where: { id }, relations: ['items', 'items.cards'] });
    if (!receipt) throw new NotFoundException('Card stock receipt not found');
    if (session && !session.isAdmin && !session.isHo && !session.isHoStaff && receipt.branchId !== session.activeBranchId) throw new ForbiddenException('CARD stock receipt does not belong to the current branch');
    return (await this.withMaskedCards([receipt]))[0];
  }

  getUploadTemplate() {
    return this.spreadsheetUploadService.writeTemplate(
      ['series', 'kit number', 'card number', 'denomination', 'expiration date'],
      ['CC', 'KIT-001', '1234567890123456', '1000', '31/12/2030'],
      'Cards',
    );
  }

  async previewUpload(file: { buffer?: Buffer; originalname?: string } | undefined, issuerPartyProfileId?: string) {
    if (!file?.buffer?.length) throw new BadRequestException('CARD stock file is required');
    const issuer = issuerPartyProfileId ? await this.requireIssuer(issuerPartyProfileId) : null;
    const { records } = this.spreadsheetUploadService.readRows(file.buffer, [
      'series',
      'kit number',
      'card number',
      'denomination',
      'expiration date',
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return records.map((record, index) => {
      const rowNumber = index + 2;
      const expirationDate = this.spreadsheetUploadService.parseDate(record['expiration date']);
      const denomination = String(record.denomination ?? '').trim();
      const cardNumberCheck = validateCardNumber(String(record['card number'] ?? ''), {
        length: issuer?.cardNumberLength,
        allowMasking: issuer?.allowCardNumberMasking,
      }, Boolean(issuer?.allowCardNumberMasking));
      const errors: string[] = [];
      if (!/^[A-Za-z0-9]{1,4}$/.test(String(record.series ?? '').trim())) {
        errors.push('Series prefix must be 1 to 4 alphanumeric characters (for example, CC)');
      }
      if (!String(record['kit number'] ?? '').trim()) errors.push('Kit number is required');
      if (!cardNumberCheck.valid) errors.push(`Row ${rowNumber}: ${cardNumberCheck.message}`);
      if (!(Number(denomination) > 0)) errors.push('Denomination must be greater than zero');
      if (!expirationDate) errors.push('Expiration date must use dd/mm/yyyy format');
      else if (new Date(`${expirationDate}T00:00:00`) <= today) errors.push('Expiration date must be in the future');
      return {
        rowNumber,
        series: String(record.series ?? '').trim(),
        kitNumber: String(record['kit number'] ?? '').trim(),
        cardNumber: cardNumberCheck.cardNumber || String(record['card number'] ?? '').trim(),
        denomination,
        amount: Number(denomination).toFixed(2),
        expirationDate,
        error: errors.join('; '),
      };
    });
  }

  async findAvailableCards(branchId: string, currencyId: string, productId: string, issuerPartyProfileId: string) {
    if (!branchId || !currencyId || !productId || !issuerPartyProfileId) return [];
    const rows = await this.database2.query(`
      SELECT c.id, c.series, c.kit_number AS "kitNumber", c.denomination, c.amount, c.expiration_date AS "expirationDate",
             i.currency_id AS "currencyId", i.product_id AS "productId", i.issuer_party_profile_id AS "issuerPartyProfileId",
             CASE WHEN length(clear_number) <= 8 THEN left(clear_number, 4) || repeat('X', greatest(length(clear_number) - 4, 0)) ELSE left(clear_number, 4) || repeat('X', length(clear_number) - 8) || right(clear_number, 4) END AS "maskedCardNumber"
      FROM card_stock_cards c JOIN card_stock_receipt_items i ON i.id=c.receipt_item_id
      CROSS JOIN LATERAL (SELECT public.decrypt_card_number(c.card_number) AS clear_number) decoded
      WHERE c.current_branch_id=$1 AND c.status='AVAILABLE' AND c.reserved_by_transfer_id IS NULL AND c.reserved_at IS NULL
        AND i.currency_id=$2 AND i.product_id=$3 AND i.issuer_party_profile_id=$4
      ORDER BY c.series, c.kit_number`, [branchId, currencyId, productId, issuerPartyProfileId]);
    return rows;
  }

  async findReloadCards(branchId: string, passengerId: string, currencyId: string, productId: string, issuerPartyProfileId: string) {
    if (!branchId || !passengerId || !currencyId || !productId || !issuerPartyProfileId) return [];
    return this.database2.query(`
      SELECT DISTINCT c.id, c.series, c.kit_number AS "kitNumber", c.denomination, c.amount, c.expiration_date AS "expirationDate",
        i.currency_id AS "currencyId", i.product_id AS "productId", i.issuer_party_profile_id AS "issuerPartyProfileId",
        CASE WHEN length(decoded.clear_number) <= 8 THEN left(decoded.clear_number, 4) || repeat('X', greatest(length(decoded.clear_number) - 4, 0)) ELSE left(decoded.clear_number, 4) || repeat('X', length(decoded.clear_number) - 8) || right(decoded.clear_number, 4) END AS "maskedCardNumber"
      FROM card_stock_cards c JOIN card_stock_receipt_items i ON i.id=c.receipt_item_id
      CROSS JOIN LATERAL (SELECT public.decrypt_card_number(c.card_number) AS clear_number) decoded
      WHERE c.current_branch_id=$1 AND c.status='SOLD' AND c.reserved_by_transfer_id IS NULL
        AND i.currency_id=$2 AND i.product_id=$3 AND i.issuer_party_profile_id=$4
        AND EXISTS (SELECT 1 FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id
          JOIN card_stock_settlements settlement ON settlement.transaction_item_id=ti.id AND settlement.branch_settlement_entry_id IS NOT NULL
          WHERE ti.card_id=c.id AND t.passenger_id=$5 AND t.transaction_type='SALE' AND t.status='APPROVED')
      ORDER BY c.series, c.kit_number`, [branchId, currencyId, productId, issuerPartyProfileId, passengerId]);
  }

  async create(dto: CreateCardStockReceiptDto, session: AuthenticatedSession): Promise<CardStockReceipt> {
    const userId = session.userId;
    const canSelectBranch = Boolean(session.isAdmin || session.isHo || session.isHoStaff);
    const effectiveBranchId = canSelectBranch ? dto.branchId : session.activeBranchId;
    if (!effectiveBranchId || (!canSelectBranch && dto.branchId !== effectiveBranchId)) throw new BadRequestException('Stock receipt must use the current branch');
    const branch = await this.requireActiveBranch(effectiveBranchId);
    const requestedReceiptDate = dto.receiptDate?.trim() || undefined;
    const datePolicy = await this.dayEndStartProcessService.assertTransactionDateAllowed(branch.id, userId, requestedReceiptDate);
    const receiptDate = requestedReceiptDate || datePolicy.allowedDate;
    const headerIssuer = await this.requireIssuer(dto.issuerPartyProfileId);
    if (!dto.items?.length) throw new BadRequestException('At least one stock item is required');

    const branchSnapshot = await loadEntitySnapshot(this.branchRepository, branch.id);
    const issuerSnapshot = await loadEntitySnapshot(this.partyProfileRepository, headerIssuer.id);
    const normalizedItems = await Promise.all(dto.items.map(item => this.validateItem(item)));
    const calculatedTotal = normalizedItems.reduce((sum, item) => sum + item.feAmount, 0);
    if (Math.abs(calculatedTotal - Number(dto.totalFeAmount)) > 0.005) throw new BadRequestException('Total FE amount does not match item totals');
    const transactionNumber = await this.additionalSettingService.reserveTransactionNumber(TransactionTypeProfileEnum.CARD_STOCK_RECEIPT, branch.code, new Date(receiptDate));

    const receipt = await this.database2.transaction(async manager => {
      const receiptRepo = manager.getRepository(CardStockReceipt);
      const itemRepo = manager.getRepository(CardStockReceiptItem);
      const cardRepo = manager.getRepository(CardStockCard);
      const seenCards = new Set<string>();
      const savedReceipt = await receiptRepo.save(receiptRepo.create({ transactionNumber, receiptDate, branchId: branch.id, branchSnapshot: branchSnapshot ?? {}, issuerPartyProfileId: headerIssuer.id, issuerPartyProfileSnapshot: issuerSnapshot ?? {}, status: CardStockReceiptStatus.POSTED, totalFeAmount: calculatedTotal.toFixed(2), createdBy: userId, updatedBy: userId }));
      const stockInTransaction = await this.cardStockTransactionService.create({
        manager,
        operationCode: TransactionTypeProfileEnum.CARD_STOCK,
        number: transactionNumber,
        branch,
        transactionDate: receiptDate,
        referenceType: CardStockReferenceType.CARD_STOCK_RECEIPT,
        referenceId: savedReceipt.id,
        actorId: userId,
      });
      savedReceipt.transactionId = stockInTransaction.id;
      await receiptRepo.save(savedReceipt);
      for (const item of normalizedItems) {
        const savedItem = await itemRepo.save(itemRepo.create({ receiptId: savedReceipt.id, lineNo: item.lineNo, currencyId: item.currencyId, currencySnapshot: item.currencySnapshot, per: item.per.toString(), productId: item.productId, productSnapshot: item.productSnapshot, issuerPartyProfileId: item.issuerPartyProfileId, issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot, feAmount: item.feAmount.toFixed(2), createdBy: userId, updatedBy: userId }));
        for (const card of item.cards) {
          const duplicateKey = `${item.issuerPartyProfileId}:${card.kitNumber.toUpperCase()}:${card.cardNumber.toUpperCase()}`;
          if (seenCards.has(duplicateKey)) throw new BadRequestException(`Duplicate kit/card number in receipt: ${card.kitNumber}`);
          seenCards.add(duplicateKey);
          const existing = await manager.query('SELECT id FROM card_stock_cards WHERE kit_number = $1 AND public.decrypt_card_number(card_number) = $2 LIMIT 1', [card.kitNumber, card.cardNumber]);
          if (existing.length) throw new BadRequestException(`Card already exists for kit number ${card.kitNumber}`);
          const encrypted = await manager.query('SELECT public.encrypt_card_number($1) AS "cardNumber"', [card.cardNumber]);
          await cardRepo.save(cardRepo.create({ receiptItemId: savedItem.id, series: card.series, quantity: 1, kitNumber: card.kitNumber, cardNumber: encrypted[0].cardNumber, denomination: card.denomination, amount: card.amount, expirationDate: card.expirationDate, currentBranchId: branch.id, currentBranchSnapshot: branchSnapshot ?? {}, status: CardStockCardStatus.AVAILABLE, reservedByTransferId: null, reservedAt: null, createdBy: userId, updatedBy: userId } as any));
        }
      }
      return savedReceipt;
    });
    return this.findById(receipt.id, session);
  }

  private async requireActiveBranch(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id, isActive: true } });
    if (!branch) throw new BadRequestException('A valid active branch is required');
    return branch;
  }

  private async requireIssuer(id: string): Promise<PartyProfile> {
    const issuer = await this.partyProfileRepository.findOne({ where: { id, active: true, status: WorkflowStatus.APPROVE, type: ClientType.CARD_ISSUER_PROFILE } as any });
    if (!issuer) throw new BadRequestException('Card issuer profile is invalid, inactive, or not approved');
    return issuer;
  }

  private async validateItem(item: CreateCardStockReceiptDto['items'][number]) {
    const [currency, product, issuer] = await Promise.all([
      this.currencyRepository.findOne({ where: { id: item.currencyId, active: true } }),
      this.productRepository.findOne({ where: { id: item.productId } }),
      this.requireIssuer(item.issuerPartyProfileId),
    ]);
    if (!currency) throw new BadRequestException(`Currency ${item.currencyId} is invalid or inactive`);
    if (!product || !product.isActiveProduct || product.productCode.toUpperCase() !== CARD_PRODUCT_CODE) throw new BadRequestException('Only active CARD product CC is allowed');
    const link = await this.productIssuerRepository.findOne({ where: { productId: product.id, partyProfileId: issuer.id } });
    if (!link) throw new BadRequestException(`Issuer ${issuer.code} is not configured for product CC`);
    if (!item.cards?.length) throw new BadRequestException(`Item ${item.lineNo} must contain at least one card`);
    const cards = item.cards.map(card => {
      if (!/^[A-Za-z0-9]{1,4}$/.test(card.series)) throw new BadRequestException(`Item ${item.lineNo}: series prefix must be 1 to 4 alphanumeric characters (for example, CC)`);
      const cardNumberCheck = validateCardNumber(card.cardNumber, {
        length: issuer.cardNumberLength,
        allowMasking: issuer.allowCardNumberMasking,
      });
      if (!cardNumberCheck.valid) throw new BadRequestException(`Item ${item.lineNo}: ${cardNumberCheck.message}`);
      if (Number(card.amount) !== Number(card.denomination)) throw new BadRequestException(`Item ${item.lineNo}: card amount is invalid`);
      if (new Date(`${card.expirationDate}T00:00:00`) <= new Date()) throw new BadRequestException(`Item ${item.lineNo}: expiration date must be in the future`);
      const seriesPrefix = card.series.toUpperCase();
      return { ...card, series: `${seriesPrefix}0000`, cardNumber: cardNumberCheck.cardNumber, denomination: Number(card.denomination), amount: Number(card.amount) };
    });
    const feAmount = cards.reduce((sum, card) => sum + card.amount, 0);
    if (Math.abs(feAmount - Number(item.feAmount)) > 0.005) throw new BadRequestException(`Item ${item.lineNo}: FE amount does not match card totals`);
    return { lineNo: item.lineNo, currencyId: currency.id, currencySnapshot: await loadEntitySnapshot(this.currencyRepository, currency.id) ?? {}, per: Number(item.per), productId: product.id, productSnapshot: await loadEntitySnapshot(this.productRepository, product.id) ?? {}, issuerPartyProfileId: issuer.id, issuerPartyProfileSnapshot: await loadEntitySnapshot(this.partyProfileRepository, issuer.id) ?? {}, feAmount, cards };
  }

  private async withMaskedCards(receipts: CardStockReceipt[]): Promise<CardStockReceipt[]> {
    const cards = receipts.flatMap(receipt => receipt.items?.flatMap(item => item.cards ?? []) ?? []);
    if (!cards.length) return receipts;
    const rows = await this.database2.query(`
      SELECT id,
        CASE
          WHEN length(clear_number) <= 8 THEN left(clear_number, 4) || repeat('X', greatest(length(clear_number) - 4, 0))
          ELSE left(clear_number, 4) || repeat('X', length(clear_number) - 8) || right(clear_number, 4)
        END AS "maskedCardNumber"
      FROM card_stock_cards
      CROSS JOIN LATERAL (SELECT public.decrypt_card_number(card_number) AS clear_number) decoded
      WHERE id = ANY($1::uuid[])
    `, [cards.map(card => card.id)]);
    const maskedById = new Map(rows.map((row: { id: string; maskedCardNumber: string }) => [row.id, row.maskedCardNumber]));
    return receipts.map(receipt => ({ ...receipt, items: receipt.items?.map(item => ({ ...item, cards: item.cards?.map(card => ({ ...card, cardNumber: undefined, maskedCardNumber: maskedById.get(card.id) ?? null })) })) }));
  }
}
