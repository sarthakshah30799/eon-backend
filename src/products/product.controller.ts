import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Session,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('products')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'List of products', type: [ProductResponseDto] })
  async findAll(
    @Query('bulkBuying') bulkBuying?: string,
    @Query('bulkSelling') bulkSelling?: string,
  ): Promise<ProductResponseDto[]> {
    return this.productService.findAll({
      bulkBuying: bulkBuying === 'true',
      bulkSelling: bulkSelling === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product details', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findById(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created', type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Conflict - Duplicate product code' })
  async create(
    @Body() dto: CreateProductDto,
    @Session() session: any,
  ): Promise<ProductResponseDto> {
    return this.productService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Duplicate product code' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Session() session: any,
  ): Promise<ProductResponseDto> {
    return this.productService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.productService.delete(id);
  }
}
