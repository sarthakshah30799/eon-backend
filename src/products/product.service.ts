import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, In, Repository } from "typeorm";
import { Product } from "./product.entity";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductListQueryDto } from "./dto/product-list-query.dto";
import { ProductResponseDto } from "./dto/product-response.dto";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { ProductCardIssuer } from "./entities/product-card-issuer.entity";
import {
  PartyProfile,
  ClientType,
} from "../party-profiles/party-profile.entity";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponseDto,
} from "../common/pagination";

const ACCOUNT_PROFILE_RELATION_FIELDS = [
  "acOfIssuer",
  "commissionAc",
  "fakeAccount",
  "lossAccount",
  "bulkPurAc",
  "openAc",
  "closingAc",
  "expenseAc",
  "bulkSaleAc",
  "purchaseAc",
  "saleAc",
  "profitAc",
  "bulkProficAc",
  "purchaseRetCancAc",
  "purchaseBlkCancAc",
  "saleRetCancAc",
  "saleBlkCancAc",
  "branchPurAc",
  "branchSaleAc",
  "profitAcBrnSale",
] as const;

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    @InjectRepository(ProductCardIssuer)
    private readonly productCardIssuerRepository: Repository<ProductCardIssuer>,
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
  ) {}

  async findAll(
    query?: ProductListQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const pagination = normalizePagination(query);
    const qb = this.productRepository.createQueryBuilder("product");

    for (const field of ACCOUNT_PROFILE_RELATION_FIELDS) {
      qb.leftJoinAndSelect(`product.${field}`, field);
    }
    qb.leftJoinAndSelect("product.cardIssuerLinks", "cardIssuerLinks").orderBy(
      "product.createdAt",
      "DESC",
    );

    if (query?.bulkBuying) {
      qb.andWhere("product.availableInBulkBuying = true");
    }
    if (query?.bulkSelling) {
      qb.andWhere("product.availableInBulkSelling = true");
    }
    if (query?.otherTransaction) {
      qb.andWhere("product.availableInOtherTransaction = true");
    }
    if (query?.activeOnly !== false) {
      qb.andWhere("product.isActiveProduct = true");
    }

    const searchStr = query?.search?.trim();
    if (searchStr) {
      qb.andWhere(
        "(product.productCode ILIKE :search OR product.productDescription ILIKE :search)",
        { search: `%${searchStr}%` },
      );
    }

    applyPagination(qb, pagination);
    const [products, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      products.map(ProductResponseDto.fromEntity),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: [...ACCOUNT_PROFILE_RELATION_FIELDS, "cardIssuerLinks"],
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return ProductResponseDto.fromEntity(product);
  }

  async create(
    dto: CreateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    const uppercaseCode = dto.productCode.toUpperCase();

    // Check for duplicate product code
    const existing = await this.productRepository.findOne({
      where: { productCode: uppercaseCode },
    });
    if (existing) {
      throw new ConflictException(
        `Product with code "${uppercaseCode}" already exists`,
      );
    }

    await this.validateAccountProfileIds(dto);
    const issuerIds = this.normalizeIds(dto.cardIssuerProfileIds);
    await this.validateNewCardIssuerProfileIds(issuerIds);

    const product = this.productRepository.create({
      ...dto,
      ...this.mapAccountingRelations(dto),
      productCode: uppercaseCode,
      createdBy: userId,
      updatedBy: userId,
    } as DeepPartial<Product>);

    // Enforce business rules: if not available, series applicability must be false
    this.applyBusinessRules(product);

    const saved = await this.productRepository.manager.transaction(
      async (manager) => {
        const savedProduct = await manager.getRepository(Product).save(product);
        await this.addCardIssuerLinks(
          manager.getRepository(ProductCardIssuer),
          savedProduct.id,
          issuerIds,
          userId,
        );
        return savedProduct;
      },
    );
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ["cardIssuerLinks"],
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    await this.validateAccountProfileIds(dto);

    const addIds = this.normalizeIds(dto.cardIssuerProfileIds);
    const removeIds = this.normalizeIds(dto.removedCardIssuerProfileIds);
    const removalSet = new Set(removeIds);
    const effectiveAddIds = addIds.filter((id) => !removalSet.has(id));
    const existingIds = new Set(
      (product.cardIssuerLinks ?? []).map((link) => link.partyProfileId),
    );

    const invalidRemovalIds = removeIds.filter((id) => !existingIds.has(id));
    if (invalidRemovalIds.length > 0) {
      throw new BadRequestException(
        `Card issuer profile link(s) not found for product: ${invalidRemovalIds.join(", ")}`,
      );
    }

    const newIds = effectiveAddIds.filter((id) => !existingIds.has(id));
    await this.validateNewCardIssuerProfileIds(newIds);

    const {
      productCode: _productCode,
      cardIssuerProfileIds: _issuerIds,
      removedCardIssuerProfileIds: _removedIds,
      ...otherFields
    } = dto;
    Object.assign(product, otherFields, this.mapAccountingRelations(dto));

    // Enforce business rules: if not available, series applicability must be false
    this.applyBusinessRules(product);

    product.updatedBy = userId;
    await this.productRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Product).save(product);
      await this.updateCardIssuerLinks(
        manager.getRepository(ProductCardIssuer),
        id,
        effectiveAddIds,
        removeIds,
        userId,
      );
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    await this.productRepository.remove(product);
    return { message: `Product with id ${id} deleted successfully` };
  }

  /**
   * Enforces business rule constraints on availability and series applicability.
   * If a transaction type is not available, its series applicability must be false.
   */
  private applyBusinessRules(product: Product): void {
    if (!product.availableInRetailBuying) {
      product.retailBuyingSeriesApplicable = false;
    }
    if (!product.availableInRetailSelling) {
      product.retailSellingSeriesApplicable = false;
    }
    if (!product.availableInBulkBuying) {
      product.bulkBuyingSeriesApplicable = false;
    }
    if (!product.availableInBulkSelling) {
      product.bulkSellingSeriesApplicable = false;
    }
  }

  private mapAccountingRelations(
    dto: Partial<CreateProductDto>,
  ): Partial<Product> {
    return ACCOUNT_PROFILE_RELATION_FIELDS.reduce<Partial<Product>>(
      (accumulator, field) => {
        const value = dto[field];

        if (value === undefined) {
          return accumulator;
        }

        accumulator[field] = value
          ? ({ id: value.trim() } as AccountProfile)
          : null;

        return accumulator;
      },
      {},
    );
  }

  private async validateAccountProfileIds(
    dto: Partial<CreateProductDto>,
  ): Promise<void> {
    const accountProfileIds = ACCOUNT_PROFILE_RELATION_FIELDS.map((field) =>
      dto[field]?.trim(),
    ).filter((value): value is string => Boolean(value));

    const uniqueIds = [...new Set(accountProfileIds)];

    if (uniqueIds.length === 0) {
      return;
    }

    const existingAccountProfiles = await this.accountProfileRepository.find({
      select: { id: true },
      where: { id: In(uniqueIds) },
    });

    if (existingAccountProfiles.length !== uniqueIds.length) {
      const existingIds = new Set(
        existingAccountProfiles.map((accountProfile) => accountProfile.id),
      );
      const missingIds = uniqueIds.filter((id) => !existingIds.has(id));

      throw new BadRequestException(
        `Invalid account profile id(s): ${missingIds.join(", ")}`,
      );
    }
  }

  private normalizeIds(ids?: string[]): string[] {
    return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
  }

  private async validateNewCardIssuerProfileIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const profiles = await this.partyProfileRepository.find({
      select: { id: true, type: true, active: true, status: true },
      where: { id: In(ids) },
    });
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    const invalid = ids.filter((id) => {
      const profile = byId.get(id);
      return (
        !profile ||
        profile.type !== ClientType.CARD_ISSUER_PROFILE ||
        !profile.active ||
        profile.status !== WorkflowStatus.APPROVE
      );
    });

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid active approved card issuer profile id(s): ${invalid.join(", ")}`,
      );
    }
  }

  private async addCardIssuerLinks(
    repository: Repository<ProductCardIssuer>,
    productId: string,
    issuerIds: string[],
    userId: string,
  ): Promise<void> {
    if (issuerIds.length === 0) {
      return;
    }

    await repository.save(
      issuerIds.map((partyProfileId) =>
        repository.create({
          productId,
          partyProfileId,
          createdBy: userId,
          updatedBy: userId,
        }),
      ),
    );
  }

  private async updateCardIssuerLinks(
    repository: Repository<ProductCardIssuer>,
    productId: string,
    addIds: string[],
    removeIds: string[],
    userId: string,
  ): Promise<void> {
    if (removeIds.length > 0) {
      await repository.delete({ productId, partyProfileId: In(removeIds) });
    }

    const existing = await repository.find({ where: { productId } });
    const existingIds = new Set(existing.map((link) => link.partyProfileId));
    await this.addCardIssuerLinks(
      repository,
      productId,
      addIds.filter((id) => !existingIds.has(id)),
      userId,
    );
  }
}
