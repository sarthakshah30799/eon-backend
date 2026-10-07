import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository, type DeepPartial } from "typeorm";
import { Branch } from "../branches/branch.entity";
import { Currency } from "../currencies/currency.entity";
import { CurrencyRate } from "../currency-rates/currency-rate.entity";
import { Product } from "../products/product.entity";
import { loadEntitySnapshot } from "../common/snapshot/entity-snapshot.util";
import type { TransactionReferenceSnapshotValue } from "../transactions/types/transaction-snapshot.types";
import { AuthenticatedSession } from "../auth/types/session-context";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import {
  ProductSettlementMode,
  ProductSettlementSaleKind,
  ProductSettlementStatus,
  ProductSettlementType,
} from "../product-settlement/product-settlement.enums";
import { ProductSettlement } from "../product-settlement/entities/product-settlement.entity";
import { ProductSettlementDocument } from "../product-settlement/entities/product-settlement-document.entity";
import {
  ProductSettlementDocumentKind,
  ProductSettlementDocumentStatus,
} from "../product-settlement/product-settlement.enums";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import {
  TransactionStatus,
  TransactionType,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import { CardStockCard } from "./entities/card-stock-card.entity";
import { CardStockTransactionEntry } from "./entities/card-stock-transaction-entry.entity";
import { CardStockBalance } from "./entities/card-stock-balance.entity";
import {
  CardStockCardStatus,
  CardStockOperationType,
  CardStockReferenceType,
} from "./card-stock.enums";
import {
  buildSurrenderProductSnapshot,
  isCardProductCode,
  isSurrenderBulkSaleProduct,
  isSurrenderBuyingProduct,
  isSurrenderMenuProduct,
  isSurrenderUnitSnapshot,
  type ProductSnapshotLike,
} from "./card-product.util";

type SqlParam = string | number | boolean | Date | null;
type ProductCodeSnapshot = ProductSnapshotLike & {
  productCode?: string | null;
  product_code?: string | null;
  code?: string | null;
};

type SoldCardSearchRow = {
  id: string;
  series: string;
  kitNumber: string;
  denomination: string;
  amount: string;
  expirationDate: Date | null;
  currentBranchId: string;
  receiptItemId: string;
  currencyId: string;
  currencySnapshot: TransactionReferenceSnapshotValue;
  productId: string;
  productSnapshot: ProductCodeSnapshot | null;
  issuerPartyProfileId: string;
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;
  maskedCardNumber: string;
};

@Injectable()
export class EmSurrenderService {
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(CardStockCard, "database2")
    private readonly cardRepository: Repository<CardStockCard>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(CurrencyRate)
    private readonly currencyRateRepository: Repository<CurrencyRate>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly additionalSettingService: AdditionalSettingService,
  ) {}

  async searchSoldCards(query: {
    search?: string;
    currencyId?: string;
    issuerPartyProfileId?: string;
    productId?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const params: SqlParam[] = [];
    const conditions = [
      `c.status = 'SOLD'`,
      `c.deleted_at IS NULL`,
      `c.reserved_by_transfer_id IS NULL`,
      `i.deleted_at IS NULL`,
    ];
    const add = (value: SqlParam, sql: string) => {
      params.push(value);
      conditions.push(sql.replace("?", `$${params.length}`));
    };
    if (query.currencyId) {
      // CM plastics are receipt-stocked under the only-stocking CM currency, but sold
      // under tradable currencies. Match receipt currency (CC) or sale/load ledger currency.
      params.push(query.currencyId);
      const receiptCurrencyParam = `$${params.length}`;
      params.push(query.currencyId);
      const saleCurrencyParam = `$${params.length}`;
      conditions.push(
        `(i.currency_id = ${receiptCurrencyParam} OR EXISTS (
          SELECT 1
          FROM card_stock_transaction_entries e
          WHERE e.card_id = c.id
            AND e.currency_id = ${saleCurrencyParam}
            AND e.reference_type = 'CARD_SALE'
            AND e.operation_type IN ('SELL', 'CARD_STOCK_LOAD')
            AND e.deleted_at IS NULL
        ))`,
      );
    }
    if (query.issuerPartyProfileId) {
      add(query.issuerPartyProfileId, `i.issuer_party_profile_id = ?`);
    }
    if (query.productId) {
      add(query.productId, `i.product_id = ?`);
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      params.push(term);
      const p = `$${params.length}`;
      conditions.push(
        `(c.kit_number ILIKE ${p} OR c.series ILIKE ${p} OR public.decrypt_card_number(c.card_number) ILIKE ${p})`,
      );
    }
    params.push(limit);
    const rows = (await this.database2.query(
      `
      SELECT c.id,
             c.series,
             c.kit_number AS "kitNumber",
             c.denomination,
             c.amount,
             c.expiration_date AS "expirationDate",
             c.current_branch_id AS "currentBranchId",
             c.receipt_item_id AS "receiptItemId",
             i.currency_id AS "currencyId",
             i.currency_snapshot AS "currencySnapshot",
             i.product_id AS "productId",
             i.product_snapshot AS "productSnapshot",
             i.issuer_party_profile_id AS "issuerPartyProfileId",
             i.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
             CASE
               WHEN length(clear_number) <= 8 THEN left(clear_number, 4) || repeat('X', greatest(length(clear_number) - 4, 0))
               ELSE left(clear_number, 4) || repeat('X', length(clear_number) - 8) || right(clear_number, 4)
             END AS "maskedCardNumber"
      FROM card_stock_cards c
      JOIN card_stock_receipt_items i ON i.id = c.receipt_item_id
      CROSS JOIN LATERAL (SELECT public.decrypt_card_number(c.card_number) AS clear_number) decoded
      WHERE ${conditions.join(" AND ")}
        AND UPPER(COALESCE(i.product_snapshot->>'productCode', i.product_snapshot->>'product_code', i.product_snapshot->>'code', '')) IN ('CC', 'CM')
      ORDER BY c.updated_at DESC
      LIMIT $${params.length}
      `,
      params,
    )) as SoldCardSearchRow[];
    return rows;
  }

  async getBaseSaleRate(currencyId: string): Promise<{ baseSaleRate: string }> {
    if (!currencyId?.trim()) {
      throw new BadRequestException("currencyId is required");
    }
    const currency = await this.currencyRepository.findOne({
      where: { id: currencyId, active: true },
    });
    if (!currency) {
      throw new BadRequestException("Currency is invalid or inactive");
    }
    const latest = await this.currencyRateRepository.findOne({
      where: { currencyId, isActive: true },
      order: { createdAt: "DESC" },
    });
    const baseSaleRate = String(
      latest?.baseSaleRate ?? latest?.baseRate ?? "0",
    );
    return { baseSaleRate };
  }

  async listEmUnitsForBulkSale(query: {
    branchId: string;
    productId: string;
    issuerPartyProfileId?: string;
    currencyId?: string;
  }) {
    const branchId = query.branchId?.trim();
    const productId = query.productId?.trim();
    if (!branchId || !productId) {
      throw new BadRequestException("branchId and productId are required");
    }
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ["issuerLinks"],
    });
    if (!product || !isSurrenderBulkSaleProduct(product)) {
      throw new BadRequestException(
        "Only non-blank-stock surrender products with linked issuers, retail buying, and bulk selling can list reserved units",
      );
    }
    const params: SqlParam[] = [branchId, productId];
    const conditions = [
      `c.status = 'RESERVED'`,
      `c.reserved_by_transfer_id IS NULL`,
      `c.current_branch_id = $1`,
      `c.deleted_at IS NULL`,
      `b.is_active = true`,
      `b.product_id = $2`,
      `b.sell_entry_id IS NULL`,
    ];
    if (query.issuerPartyProfileId) {
      params.push(query.issuerPartyProfileId);
      conditions.push(`b.issuer_party_profile_id = $${params.length}`);
    }
    if (query.currencyId) {
      params.push(query.currencyId);
      conditions.push(`b.currency_id = $${params.length}`);
    }
    return this.database2.query(
      `
      SELECT c.id,
             c.series,
             c.kit_number AS "kitNumber",
             c.denomination,
             c.amount,
             c.expiration_date AS "expirationDate",
             b.currency_id AS "currencyId",
             b.product_id AS "productId",
             b.issuer_party_profile_id AS "issuerPartyProfileId",
             CASE
               WHEN length(clear_number) <= 8 THEN left(clear_number, 4) || repeat('X', greatest(length(clear_number) - 4, 0))
               ELSE left(clear_number, 4) || repeat('X', length(clear_number) - 8) || right(clear_number, 4)
             END AS "maskedCardNumber"
      FROM card_stock_cards c
      JOIN card_stock_balance b ON b.card_id = c.id AND b.is_active = true AND b.deleted_at IS NULL
      CROSS JOIN LATERAL (SELECT public.decrypt_card_number(c.card_number) AS clear_number) decoded
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.series, c.kit_number
      `,
      params,
    );
  }

  buildEmCardNumber(
    branchCode: string,
    transactionDate: Date,
    transactionNumber: string,
    lineNo: number,
  ): string {
    const branch = String(branchCode ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .padEnd(4, "0")
      .slice(0, 4);
    const year = String(transactionDate.getUTCFullYear()).slice(-2);
    const txn = String(transactionNumber ?? "")
      .replace(/\D/g, "")
      .slice(-8)
      .padStart(8, "0");
    const series = String(Math.max(1, Number(lineNo) || 1))
      .replace(/\D/g, "")
      .slice(-2)
      .padStart(2, "0");
    return `${branch}${year}${txn}${series}`;
  }

  assertEmPurchaseProduct(product: Product) {
    if (!isSurrenderBuyingProduct(product)) {
      throw new BadRequestException(
        "Product surrender requires a non-blank-stock product with linked issuers, retail buying, and bulk selling",
      );
    }
  }

  async createEmUnitOnPurchase(input: {
    manager: EntityManager;
    transaction: Transaction;
    item: TransactionItem;
    sourceSoldCardId: string;
    emProduct: Product;
    actorId: string;
    lineNo: number;
    autoSurrender: boolean;
  }): Promise<CardStockCard> {
    const {
      manager,
      transaction,
      item,
      sourceSoldCardId,
      emProduct,
      actorId,
      lineNo,
      autoSurrender,
    } = input;
    this.assertEmPurchaseProduct(emProduct);
    const source = await manager.getRepository(CardStockCard).findOne({
      where: { id: sourceSoldCardId },
      relations: ["receiptItem"],
    });
    if (!source?.receiptItem) {
      throw new BadRequestException("Selected sold CARD was not found");
    }
    if (source.status !== CardStockCardStatus.SOLD) {
      throw new BadRequestException("Product surrender requires a sold CARD");
    }
    const sourceProductSnapshot =
      source.receiptItem.productSnapshot as ProductCodeSnapshot | null;
    const sourceProductCode = String(
      sourceProductSnapshot?.productCode ??
        sourceProductSnapshot?.product_code ??
        sourceProductSnapshot?.code ??
        "",
    ).toUpperCase();
    if (sourceProductCode && !isCardProductCode(sourceProductCode)) {
      throw new BadRequestException(
        "Product surrender source must be a sold CC or CM card",
      );
    }

    const branch = await this.branchRepository.findOne({
      where: { id: transaction.branchId },
    });
    if (!branch) throw new BadRequestException("Transaction branch not found");

    const feAmount = Number(item.quantity);
    if (!Number.isFinite(feAmount) || feAmount <= 0) {
      throw new BadRequestException(
        "Surrender FE amount must be greater than 0",
      );
    }
    const buyRate = Number(item.rate);
    if (!Number.isFinite(buyRate) || buyRate < 0) {
      throw new BadRequestException("Surrender buy rate is invalid");
    }

    const baseSale = await this.getBaseSaleRate(item.currencyId);
    const baseSaleRate = Number(baseSale.baseSaleRate);
    if (Number.isFinite(baseSaleRate) && baseSaleRate > 0 && buyRate > baseSaleRate) {
      throw new BadRequestException(
        `Surrender purchase rate ${buyRate} cannot exceed base sale price ${baseSaleRate}`,
      );
    }

    const generatedNumber = this.buildEmCardNumber(
      branch.code,
      new Date(transaction.transactionDate),
      transaction.number,
      lineNo,
    );
    const encrypted = await manager.query(
      'SELECT public.encrypt_card_number($1) AS "cardNumber"',
      [generatedNumber],
    );
    const branchSnapshot =
      transaction.branchSnapshot ??
      ((await loadEntitySnapshot(this.branchRepository, branch.id)) as object);

    await manager.query(
      `SELECT set_config('app.skip_card_stock_card_insert_ledger', 'true', true)`,
    );

    const emCard = (await manager.getRepository(CardStockCard).save(
      manager.getRepository(CardStockCard).create({
        receiptItemId: source.receiptItemId,
        series: source.series,
        quantity: 1,
        kitNumber: source.kitNumber,
        cardNumber: encrypted[0].cardNumber,
        denomination: feAmount.toFixed(2),
        amount: feAmount.toFixed(2),
        expirationDate: source.expirationDate,
        currentBranchId: branch.id,
        currentBranchSnapshot:
          branchSnapshot as TransactionReferenceSnapshotValue,
        status: CardStockCardStatus.RESERVED,
        reservedByTransferId: null,
        reservedAt: null,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    )) as CardStockCard;

    // Blank-stock card-insert trigger may still create a CM receipt-branch balance
    // when the skip GUC migration is not applied yet. Clear those before EM receive.
    await manager.query(
      `
      UPDATE card_stock_balance
         SET is_active = false,
             updated_by = $2,
             updated_at = NOW()
       WHERE card_id = $1
         AND is_active = true
         AND deleted_at IS NULL
      `,
      [emCard.id, actorId],
    );
    await manager.query(
      `
      UPDATE card_stock_transaction_entries
         SET deleted_at = NOW(),
             deleted_by = $2,
             updated_by = $2,
             updated_at = NOW()
       WHERE card_id = $1
         AND operation_type = 'STOCK'
         AND deleted_at IS NULL
      `,
      [emCard.id, actorId],
    );

    const productSnapshot =
      (item.productSnapshot as ProductCodeSnapshot | null) ??
      buildSurrenderProductSnapshot(emProduct);

    const entry = (await manager
      .getRepository(CardStockTransactionEntry)
      .save(
        manager.getRepository(CardStockTransactionEntry).create({
          cardId: emCard.id,
          transactionId: transaction.id,
          referenceType: CardStockReferenceType.CARD_STOCK_RECEIPT,
          referenceId: item.id,
          operationType: CardStockOperationType.STOCK,
          branchId: branch.id,
          branchSnapshot: branchSnapshot as any,
          currencyId: item.currencyId,
          currencySnapshot: item.currencySnapshot,
          productId: emProduct.id,
          productSnapshot,
          issuerPartyProfileId: item.issuerPartyProfileId!,
          issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot,
          series: emCard.series,
          date: new Date(transaction.transactionDate),
          rate: buyRate.toFixed(7),
          amount: (feAmount * buyRate).toFixed(2),
          remarks: "Product surrender receive",
          createdBy: actorId,
          updatedBy: actorId,
        }),
      )) as CardStockTransactionEntry;

    const existingBalance = await manager.getRepository(CardStockBalance).findOne({
      where: {
        cardId: emCard.id,
        branchId: branch.id,
        isActive: true,
      },
    });
    if (existingBalance) {
      await manager.getRepository(CardStockBalance).update(existingBalance.id, {
        currencyId: item.currencyId,
        currencySnapshot: item.currencySnapshot,
        productId: emProduct.id,
        productSnapshot,
        issuerPartyProfileId: item.issuerPartyProfileId!,
        issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot,
        series: emCard.series,
        receiveDate: new Date(transaction.transactionDate),
        receiveRate: buyRate.toFixed(7),
        receiveAmount: (feAmount * buyRate).toFixed(2),
        receiveEntryId: entry.id,
        isActive: true,
        updatedBy: actorId,
      } as any);
    } else {
      await manager.getRepository(CardStockBalance).save(
        manager.getRepository(CardStockBalance).create({
          cardId: emCard.id,
          branchId: branch.id,
          branchSnapshot: branchSnapshot as any,
          currencyId: item.currencyId,
          currencySnapshot: item.currencySnapshot,
          productId: emProduct.id,
          productSnapshot,
          issuerPartyProfileId: item.issuerPartyProfileId!,
          issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot,
          series: emCard.series,
          receiveDate: new Date(transaction.transactionDate),
          receiveRate: buyRate.toFixed(7),
          receiveAmount: (feAmount * buyRate).toFixed(2),
          receiveEntryId: entry.id,
          isActive: true,
          createdBy: actorId,
          updatedBy: actorId,
        } as any),
      );
    }

    await manager.query(
      `SELECT set_config('app.skip_card_stock_card_insert_ledger', 'false', true)`,
    );

    item.cardId = emCard.id;
    await manager.getRepository(TransactionItem).save(item);

    if (autoSurrender) {
      await this.createPendingHoSettlement({
        manager,
        transaction,
        item,
        emCard,
        emProduct,
        actorId,
        buyRate,
        feAmount,
      });
    }

    return emCard;
  }

  private async createPendingHoSettlement(input: {
    manager: EntityManager;
    transaction: Transaction;
    item: TransactionItem;
    emCard: CardStockCard;
    emProduct: Product;
    actorId: string;
    buyRate: number;
    feAmount: number;
  }) {
    const { manager, transaction, item, emCard, emProduct, actorId, buyRate, feAmount } =
      input;
    const ho = await this.branchRepository.findOne({
      where: { isHeadOffice: true, isActive: true },
    });
    if (!ho) {
      throw new BadRequestException(
        "HO branch is required for product auto surrender",
      );
    }
    const saleBuyRate = buyRate.toFixed(7);
    const settlementAmount = (feAmount * buyRate).toFixed(2);
    const saleDate = new Date(transaction.transactionDate);
    const selling = await this.branchRepository.findOne({
      where: { id: transaction.branchId },
    });
    if (!selling) {
      throw new BadRequestException("Selling branch not found");
    }

    const settlement = (await manager.getRepository(ProductSettlement).save(
      manager.getRepository(ProductSettlement).create({
        type: ProductSettlementType.CARD,
        productCode: String(emProduct.productCode ?? "")
          .trim()
          .toUpperCase(),
        cardId: emCard.id,
        dealCoverId: null,
        transactionId: transaction.id,
        transactionItemId: item.id,
        branchId: transaction.branchId,
        branchSnapshot: transaction.branchSnapshot,
        hoBranchId: ho.id,
        hoBranchSnapshot: {
          id: ho.id,
          code: ho.code,
          name: ho.name,
          label: `${ho.code} - ${ho.name}`,
        },
        issuerPartyProfileId: item.issuerPartyProfileId!,
        issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot,
        currencyId: item.currencyId,
        currencySnapshot: item.currencySnapshot,
        productId: emProduct.id,
        productSnapshot:
          (item.productSnapshot as ProductCodeSnapshot | null) ??
          buildSurrenderProductSnapshot(emProduct),
        passengerId: transaction.passengerId,
        passengerSnapshot: transaction.passengerSnapshot,
        series: emCard.series,
        denomination: feAmount.toFixed(2),
        saleBuyRate,
        buyRate: saleBuyRate,
        bookingRate: null,
        buyRateSnapshot: { source: "PRODUCT_SURRENDER", rate: saleBuyRate },
        settlementAmount,
        saleDate,
        settlementMode: ProductSettlementMode.AUTO,
        saleKind: ProductSettlementSaleKind.FRESH,
        branchRequestedDate: saleDate,
        branchReference: null,
        branchRemarks: "Product auto surrender",
        branchRequestedAt: new Date(),
        branchRequestedById: actorId,
        status:
          transaction.branchId === ho.id
            ? ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT
            : ProductSettlementStatus.PENDING_HO_ACCEPTANCE,
        createdBy: actorId,
        updatedBy: actorId,
      } as DeepPartial<ProductSettlement>),
    )) as ProductSettlement;

    if (transaction.branchId === ho.id) {
      return settlement;
    }

    const number =
      await this.additionalSettingService.reserveTransactionNumber(
        TransactionTypeProfileEnum.CARD_SETTLE,
        selling.code,
        saleDate,
      );
    const document = (await manager
      .getRepository(ProductSettlementDocument)
      .save(
        manager.getRepository(ProductSettlementDocument).create({
          kind: ProductSettlementDocumentKind.BRANCH_HO,
          status: ProductSettlementDocumentStatus.PENDING_HO_ACCEPTANCE,
          transactionNumber: number,
          transactionDate: saleDate,
          issuerPartyProfileId: item.issuerPartyProfileId!,
          issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot,
          currencyId: item.currencyId,
          currencySnapshot: item.currencySnapshot,
          branchId: transaction.branchId,
          branchSnapshot: transaction.branchSnapshot,
          hoBranchId: ho.id,
          hoBranchSnapshot: {
            id: ho.id,
            code: ho.code,
            name: ho.name,
            label: `${ho.code} - ${ho.name}`,
          },
          reference: null,
          remarks: "Product auto surrender",
          createdBy: actorId,
          updatedBy: actorId,
        } as DeepPartial<ProductSettlementDocument>),
      )) as ProductSettlementDocument;
    settlement.branchDocumentId = document.id;
    await manager.getRepository(ProductSettlement).save(settlement);
    return settlement;
  }

  async cleanupEmPurchase(
    manager: EntityManager,
    transactionId: string,
    actorId: string,
  ) {
    const settlements = await manager.getRepository(ProductSettlement).find({
      where: { transactionId },
    });
    const settlementProductIds = [
      ...new Set(
        settlements.map((row) => row.productId).filter(Boolean) as string[],
      ),
    ];
    const surrenderProductIds = new Set(
      settlementProductIds.length
        ? (
            await this.productRepository.find({
              where: { id: In(settlementProductIds) },
              relations: ["issuerLinks"],
            })
          )
            .filter((product) => isSurrenderBuyingProduct(product))
            .map((product) => product.id)
        : [],
    );
    for (const row of settlements) {
      if (!surrenderProductIds.has(row.productId)) continue;
      if (row.branchDocumentId) {
        await manager.getRepository(ProductSettlementDocument).update(
          row.branchDocumentId,
          {
            status: ProductSettlementDocumentStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledById: actorId,
            cancellationReason: "Product surrender rejected/cancelled",
            updatedBy: actorId,
          },
        );
      }
      await manager.getRepository(ProductSettlement).softDelete(row.id);
    }
    const items = await manager.getRepository(TransactionItem).find({
      where: { transactionId },
    });
    for (const item of items) {
      if (!item.cardId) continue;
      const card = await manager.getRepository(CardStockCard).findOne({
        where: { id: item.cardId },
      });
      if (!card || card.status !== CardStockCardStatus.RESERVED) continue;
      const balance = await manager.getRepository(CardStockBalance).findOne({
        where: { cardId: card.id, isActive: true },
      });
      if (
        balance &&
        isSurrenderUnitSnapshot(
          balance.productSnapshot as ProductCodeSnapshot | null,
        )
      ) {
        await manager
          .getRepository(CardStockBalance)
          .update(balance.id, { isActive: false, updatedBy: actorId });
        await manager.getRepository(CardStockCard).softDelete(card.id);
      }
    }
  }

  async moveEmCardsToHoOnAccept(
    manager: EntityManager,
    settlements: ProductSettlement[],
    actorId: string,
  ) {
    const productIds = [
      ...new Set(
        settlements.map((row) => row.productId).filter(Boolean) as string[],
      ),
    ];
    const surrenderProductIds = new Set(
      productIds.length
        ? (
            await this.productRepository.find({
              where: { id: In(productIds) },
              relations: ["issuerLinks"],
            })
          )
            .filter((product) => isSurrenderMenuProduct(product))
            .map((product) => product.id)
        : [],
    );
    for (const row of settlements) {
      if (!row.cardId || !surrenderProductIds.has(row.productId)) continue;
      const card = await manager.getRepository(CardStockCard).findOne({
        where: { id: row.cardId },
      });
      if (!card) continue;
      const hoSnapshot =
        row.hoBranchSnapshot ??
        ((await loadEntitySnapshot(
          this.branchRepository,
          row.hoBranchId,
        )) as object);
      card.currentBranchId = row.hoBranchId;
      card.currentBranchSnapshot = hoSnapshot as any;
      card.status = CardStockCardStatus.RESERVED;
      card.reservedByTransferId = null;
      card.reservedAt = null;
      card.updatedBy = actorId;
      await manager.getRepository(CardStockCard).save(card);

      const active = await manager.getRepository(CardStockBalance).findOne({
        where: { cardId: card.id, isActive: true },
      });
      if (active && active.branchId !== row.hoBranchId) {
        await manager
          .getRepository(CardStockBalance)
          .update(active.id, { isActive: false, updatedBy: actorId });
        await manager.getRepository(CardStockBalance).save(
          manager.getRepository(CardStockBalance).create({
            ...active,
            id: undefined as any,
            branchId: row.hoBranchId,
            branchSnapshot: hoSnapshot as any,
            isActive: true,
            createdBy: actorId,
            updatedBy: actorId,
            createdAt: undefined as any,
            updatedAt: undefined as any,
          } as any),
        );
      }
    }
  }

  /**
   * HO bulk SALE of surrender units → issuer. Marks RESERVED card SOLD and writes
   * SELL ledger. Does not create product_settlements issuer rows.
   */
  async finalizeEmIssuerSale(
    manager: EntityManager,
    transaction: Transaction,
    items: TransactionItem[],
    actorId: string,
  ) {
    if (
      transaction.status !== TransactionStatus.APPROVED ||
      transaction.transactionType !== TransactionType.SALE
    ) {
      throw new BadRequestException(
        "Surrender issuer sale requires an approved SALE transaction",
      );
    }
    const surrenderItems = items.filter((item) => Boolean(item.cardId));
    if (!surrenderItems.length) return;

    for (const item of surrenderItems) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
        relations: ["issuerLinks"],
      });
      if (!product || !isSurrenderBulkSaleProduct(product)) {
        throw new BadRequestException(
          `Item ${item.lineNo} must use a non-blank-stock surrender product with linked issuers, retail buying, and bulk selling`,
        );
      }
      if (!item.issuerPartyProfileId) {
        throw new BadRequestException(
          `Surrender item ${item.lineNo} requires an issuer`,
        );
      }
      const card = await manager.getRepository(CardStockCard).findOne({
        where: { id: String(item.cardId) },
      });
      if (!card) {
        throw new NotFoundException(
          `Surrender card for item ${item.lineNo} was not found`,
        );
      }
      if (card.currentBranchId !== transaction.branchId) {
        throw new BadRequestException(
          `Surrender item ${item.lineNo} is not held by the sale branch`,
        );
      }
      if (
        card.status !== CardStockCardStatus.RESERVED ||
        card.reservedByTransferId
      ) {
        throw new BadRequestException(
          `Surrender item ${item.lineNo} is not available for issuer sale`,
        );
      }
      const balance = await manager.getRepository(CardStockBalance).findOne({
        where: { cardId: card.id, isActive: true },
      });
      if (!balance || balance.sellEntryId) {
        throw new BadRequestException(
          `Surrender item ${item.lineNo} has no open balance for sale`,
        );
      }
      if (
        !isSurrenderUnitSnapshot(
          balance.productSnapshot as ProductCodeSnapshot | null,
        )
      ) {
        throw new BadRequestException(
          `Surrender item ${item.lineNo} balance is not a surrender unit`,
        );
      }

      const sellRate = Number(item.rate);
      const feAmount = Number(item.quantity);
      if (!Number.isFinite(sellRate) || sellRate < 0) {
        throw new BadRequestException(
          `Surrender item ${item.lineNo} rate is invalid`,
        );
      }
      if (!Number.isFinite(feAmount) || feAmount <= 0) {
        throw new BadRequestException(
          `Surrender item ${item.lineNo} FE amount must be greater than 0`,
        );
      }

      const productSnapshot =
        (item.productSnapshot as ProductCodeSnapshot | null) ??
        buildSurrenderProductSnapshot(product);

      const sellEntry = (await manager
        .getRepository(CardStockTransactionEntry)
        .save(
          manager.getRepository(CardStockTransactionEntry).create({
            cardId: card.id,
            transactionId: transaction.id,
            referenceType: CardStockReferenceType.CARD_SALE,
            referenceId: transaction.id,
            operationType: CardStockOperationType.SELL,
            branchId: transaction.branchId,
            branchSnapshot: transaction.branchSnapshot as any,
            currencyId: item.currencyId,
            currencySnapshot: item.currencySnapshot,
            productId: product.id,
            productSnapshot,
            issuerPartyProfileId: item.issuerPartyProfileId,
            issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot,
            series: card.series,
            date: new Date(transaction.transactionDate),
            rate: sellRate.toFixed(7),
            amount: (feAmount * sellRate).toFixed(2),
            remarks: "Product surrender issuer sale",
            createdBy: actorId,
            updatedBy: actorId,
          }),
        )) as CardStockTransactionEntry;

      await manager.getRepository(CardStockBalance).update(balance.id, {
        sellDate: new Date(transaction.transactionDate),
        sellRate: sellRate.toFixed(7),
        sellAmount: (feAmount * sellRate).toFixed(2),
        sellEntryId: sellEntry.id,
        updatedBy: actorId,
      } as any);

      card.status = CardStockCardStatus.SOLD;
      card.updatedBy = actorId;
      await manager.getRepository(CardStockCard).save(card);
    }
  }

  assertSession(session: AuthenticatedSession) {
    if (!session?.userId) {
      throw new BadRequestException("Authenticated session is required");
    }
  }
}
