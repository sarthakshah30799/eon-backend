import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { CardStockReceiptStatus, CardStockCardStatus } from './card-stock.enums';
import { CreateCardStockReceiptDto } from './dto/card-stock-receipt.dto';

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
  ) {}

  async findAll(branchId?: string): Promise<CardStockReceipt[]> {
    const query = this.receiptRepository.createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.items', 'item')
      .leftJoinAndSelect('item.cards', 'card')
      .orderBy('receipt.receiptDate', 'DESC')
      .addOrderBy('receipt.createdAt', 'DESC');
    if (branchId) query.where('receipt.hoBranchId = :branchId', { branchId });
    const receipts = await query.getMany();
    return this.withMaskedCards(receipts);
  }

  async findById(id: string): Promise<CardStockReceipt> {
    const receipt = await this.receiptRepository.findOne({ where: { id }, relations: ['items', 'items.cards'] });
    if (!receipt) throw new NotFoundException('Card stock receipt not found');
    return (await this.withMaskedCards([receipt]))[0];
  }

  async create(dto: CreateCardStockReceiptDto, userId: string): Promise<CardStockReceipt> {
    const branch = await this.requireHoBranch(dto.hoBranchId);
    const requestedReceiptDate = dto.receiptDate?.trim() || undefined;
    const datePolicy = await this.dayEndStartProcessService.assertTransactionDateAllowed(dto.hoBranchId, userId, requestedReceiptDate);
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
      const savedReceipt = await receiptRepo.save(receiptRepo.create({ transactionNumber, receiptDate, hoBranchId: branch.id, hoBranchSnapshot: branchSnapshot ?? {}, issuerPartyProfileId: headerIssuer.id, issuerPartyProfileSnapshot: issuerSnapshot ?? {}, status: CardStockReceiptStatus.POSTED, totalFeAmount: calculatedTotal.toFixed(2), createdBy: userId, updatedBy: userId }));
      for (const item of normalizedItems) {
        const savedItem = await itemRepo.save(itemRepo.create({ receiptId: savedReceipt.id, lineNo: item.lineNo, currencyId: item.currencyId, currencySnapshot: item.currencySnapshot, per: item.per.toString(), productId: item.productId, productSnapshot: item.productSnapshot, issuerPartyProfileId: item.issuerPartyProfileId, issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot, feAmount: item.feAmount.toFixed(2), createdBy: userId, updatedBy: userId }));
        for (const card of item.cards) {
          const duplicateKey = `${item.issuerPartyProfileId}:${card.kitNumber.toUpperCase()}:${card.cardNumber.toUpperCase()}`;
          if (seenCards.has(duplicateKey)) throw new BadRequestException(`Duplicate kit/card number in receipt: ${card.kitNumber}`);
          seenCards.add(duplicateKey);
          const existing = await manager.query('SELECT id FROM card_stock_cards WHERE kit_number = $1 AND public.decrypt_card_number(card_number) = $2 LIMIT 1', [card.kitNumber, card.cardNumber]);
          if (existing.length) throw new BadRequestException(`Card already exists for kit number ${card.kitNumber}`);
          const encrypted = await manager.query('SELECT public.encrypt_card_number($1) AS "cardNumber"', [card.cardNumber]);
          await cardRepo.save(cardRepo.create({ receiptItemId: savedItem.id, series: card.series, quantity: card.quantity, kitNumber: card.kitNumber, cardNumber: encrypted[0].cardNumber, denomination: card.denomination, amount: card.amount, expirationDate: card.expirationDate, currentBranchId: branch.id, currentBranchSnapshot: branchSnapshot ?? {}, status: CardStockCardStatus.AVAILABLE, reservedByTransferId: null, reservedAt: null, createdBy: userId, updatedBy: userId } as any));
        }
      }
      return savedReceipt;
    });
    return this.findById(receipt.id);
  }

  private async requireHoBranch(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id, isActive: true } });
    if (!branch || !branch.isHeadOffice) throw new BadRequestException('A valid active HO branch is required');
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
      if (card.quantity !== 1) throw new BadRequestException(`Item ${item.lineNo}: card quantity must be 1`);
      if (!/^[A-Za-z0-9]{6}$/.test(card.series)) throw new BadRequestException(`Item ${item.lineNo}: series must be exactly 6 alphanumeric characters (for example, CC0000)`);
      if (!/^(\d{8}|\d{16}|\d{4}X+\d{4})$/.test(card.cardNumber.replace(/\s/g, '').toUpperCase())) throw new BadRequestException(`Item ${item.lineNo}: card number must be 8/16 digits or a valid mask`);
      if (Number(card.amount) !== Number(card.denomination) * card.quantity) throw new BadRequestException(`Item ${item.lineNo}: card amount is invalid`);
      if (new Date(`${card.expirationDate}T00:00:00`) <= new Date()) throw new BadRequestException(`Item ${item.lineNo}: expiration date must be in the future`);
      return { ...card, cardNumber: card.cardNumber.replace(/\s/g, ''), denomination: Number(card.denomination), amount: Number(card.amount) };
    });
    const feAmount = cards.reduce((sum, card) => sum + card.amount, 0);
    if (Math.abs(feAmount - Number(item.feAmount)) > 0.005) throw new BadRequestException(`Item ${item.lineNo}: FE amount does not match card totals`);
    return { lineNo: item.lineNo, currencyId: currency.id, currencySnapshot: await loadEntitySnapshot(this.currencyRepository, currency.id) ?? {}, per: Number(item.per), productId: product.id, productSnapshot: await loadEntitySnapshot(this.productRepository, product.id) ?? {}, issuerPartyProfileId: issuer.id, issuerPartyProfileSnapshot: await loadEntitySnapshot(this.partyProfileRepository, issuer.id) ?? {}, feAmount, cards };
  }

  private async withMaskedCards(receipts: CardStockReceipt[]): Promise<CardStockReceipt[]> {
    const cards = receipts.flatMap(receipt => receipt.items?.flatMap(item => item.cards ?? []) ?? []);
    if (!cards.length) return receipts;
    const rows = await this.database2.query('SELECT id, public.decrypt_card_number(card_number) AS "maskedCardNumber" FROM card_stock_cards WHERE id = ANY($1::uuid[])', [cards.map(card => card.id)]);
    const maskedById = new Map(rows.map((row: { id: string; maskedCardNumber: string }) => [row.id, row.maskedCardNumber]));
    return receipts.map(receipt => ({ ...receipt, items: receipt.items?.map(item => ({ ...item, cards: item.cards?.map(card => ({ ...card, cardNumber: undefined, maskedCardNumber: maskedById.get(card.id) ?? null })) })) }));
  }
}
