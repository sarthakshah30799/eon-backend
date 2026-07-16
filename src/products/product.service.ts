import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { AccountProfile } from '../account-profiles/account-profile.entity';

const ACCOUNT_PROFILE_RELATION_FIELDS = [
  'acOfIssuer',
  'commissionAc',
  'fakeAccount',
  'bulkPurAc',
  'openAc',
  'closingAc',
  'expenseAc',
  'bulkSaleAc',
  'purchaseAc',
  'saleAc',
  'profitAc',
  'bulkProficAc',
  'purchaseRetCancAc',
  'purchaseBlkCancAc',
  'saleRetCancAc',
  'saleBlkCancAc',
  'branchPurAc',
  'branchSaleAc',
  'profitAcBrnSale',
] as const;

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
  ) {}

  async findAll(filter?: { bulkBuying?: boolean; bulkSelling?: boolean }): Promise<ProductResponseDto[]> {
    const where: Record<string, boolean> = {};
    if (filter?.bulkBuying) where.availableInBulkBuying = true;
    if (filter?.bulkSelling) where.availableInBulkSelling = true;

    const products = await this.productRepository.find({
      where: Object.keys(where).length ? where : undefined,
      relations: [...ACCOUNT_PROFILE_RELATION_FIELDS],
      order: { createdAt: 'DESC' },
    });
    return products.map(ProductResponseDto.fromEntity);
  }

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: [...ACCOUNT_PROFILE_RELATION_FIELDS],
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return ProductResponseDto.fromEntity(product);
  }

  async create(
    dto: CreateProductDto,
    userId: string
  ): Promise<ProductResponseDto> {
    const uppercaseCode = dto.productCode.toUpperCase();

    // Check for duplicate product code
    const existing = await this.productRepository.findOne({
      where: { productCode: uppercaseCode },
    });
    if (existing) {
      throw new ConflictException(`Product with code "${uppercaseCode}" already exists`);
    }

    await this.validateAccountProfileIds(dto);

    const product = this.productRepository.create({
      ...dto,
      ...this.mapAccountingRelations(dto),
      productCode: uppercaseCode,
      createdBy: userId,
      updatedBy: userId,
    } as DeepPartial<Product>);

    // Enforce business rules: if not available, series applicability must be false
    this.applyBusinessRules(product);

    const saved = await this.productRepository.save(product);
    return ProductResponseDto.fromEntity(saved);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    userId: string
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    await this.validateAccountProfileIds(dto);

    const { productCode: _productCode, ...otherFields } = dto;
    Object.assign(product, otherFields, this.mapAccountingRelations(dto));
    
    // Enforce business rules: if not available, series applicability must be false
    this.applyBusinessRules(product);

    product.updatedBy = userId;
    const saved = await this.productRepository.save(product);
    return ProductResponseDto.fromEntity(saved);
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
    dto: Partial<CreateProductDto>
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
      {}
    );
  }

  private async validateAccountProfileIds(
    dto: Partial<CreateProductDto>
  ): Promise<void> {
    const accountProfileIds = ACCOUNT_PROFILE_RELATION_FIELDS.map(field =>
      dto[field]?.trim()
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
        existingAccountProfiles.map(accountProfile => accountProfile.id)
      );
      const missingIds = uniqueIds.filter(id => !existingIds.has(id));

      throw new BadRequestException(
        `Invalid account profile id(s): ${missingIds.join(', ')}`
      );
    }
  }
}
