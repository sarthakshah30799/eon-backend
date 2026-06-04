import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productRepository.find({
      order: { createdAt: 'DESC' },
    });
    return products.map(ProductResponseDto.fromEntity);
  }

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return ProductResponseDto.fromEntity(product);
  }

  async create(dto: CreateProductDto, userId: string): Promise<ProductResponseDto> {
    const uppercaseCode = dto.productCode.toUpperCase();
    
    // Check for duplicate product code
    const existing = await this.productRepository.findOne({
      where: { productCode: uppercaseCode },
    });
    if (existing) {
      throw new ConflictException(`Product with code "${uppercaseCode}" already exists`);
    }

    const product = this.productRepository.create({
      ...dto,
      productCode: uppercaseCode,
      createdBy: userId,
      updatedBy: userId,
    });

    // Enforce business rules: if not available, series applicability must be false
    this.applyBusinessRules(product);

    const saved = await this.productRepository.save(product);
    return ProductResponseDto.fromEntity(saved);
  }

  async update(id: string, dto: UpdateProductDto, userId: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    if (dto.productCode) {
      const uppercaseCode = dto.productCode.toUpperCase();
      if (uppercaseCode !== product.productCode) {
        const existing = await this.productRepository.findOne({
          where: { productCode: uppercaseCode },
        });
        if (existing) {
          throw new ConflictException(`Product with code "${uppercaseCode}" already exists`);
        }
        product.productCode = uppercaseCode;
      }
    }

    // Object.assign to merge update DTO
    const { productCode, ...otherFields } = dto;
    Object.assign(product, otherFields);
    
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
}
