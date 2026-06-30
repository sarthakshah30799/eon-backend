import { Body, Controller, Get, Param, Post, Put, Query, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrencyRatesService } from './currency-rates.service';
import { CreateCurrencyRateGroupDto } from './dto/create-currency-rate-group.dto';
import { UpdateCurrencyRateGroupDto } from './dto/update-currency-rate-group.dto';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { PreviewCurrencyRateDto } from './dto/preview-currency-rate.dto';
import { CreateProductCurrencyRateDto } from './dto/create-product-currency-rate.dto';
import { UpdateProductCurrencyRateDto } from './dto/update-product-currency-rate.dto';
import { CurrencyRateGroupResponseDto } from './dto/currency-rate-group-response.dto';
import { CurrencyRateResponseDto } from './dto/currency-rate-response.dto';
import { CurrencyRateQuoteResponseDto } from './dto/currency-rate-quote-response.dto';
import { ProductCurrencyRateResponseDto } from './dto/product-currency-rate-response.dto';

@ApiTags('currency-rates')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('currency-rates')
export class CurrencyRatesController {
  constructor(private readonly service: CurrencyRatesService) {}

  @Get('groups')
  @ApiOperation({ summary: 'Get all currency rate groups' })
  @ApiResponse({ status: 200, type: [CurrencyRateGroupResponseDto] })
  async getGroups(): Promise<CurrencyRateGroupResponseDto[]> {
    const groups = await this.service.findGroups();
    return groups.map(CurrencyRateGroupResponseDto.fromEntity);
  }

  @Post('groups')
  @ApiOperation({ summary: 'Create a currency rate group' })
  async createGroup(
    @Body() dto: CreateCurrencyRateGroupDto,
    @Session() session: { userId: string },
  ): Promise<CurrencyRateGroupResponseDto> {
    const group = await this.service.createGroup(dto, session.userId);
    return CurrencyRateGroupResponseDto.fromEntity(group);
  }

  @Put('groups/:id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update a currency rate group' })
  async updateGroup(
    @Param('id') id: string,
    @Body() dto: UpdateCurrencyRateGroupDto,
    @Session() session: { userId: string },
  ): Promise<CurrencyRateGroupResponseDto> {
    const group = await this.service.updateGroup(id, dto, session.userId);
    return CurrencyRateGroupResponseDto.fromEntity(group);
  }

  @Post('rates')
  @ApiOperation({ summary: 'Create a manual currency rate entry' })
  async createRateEntry(
    @Body() dto: CreateCurrencyRateDto,
    @Session() session: { userId: string },
  ): Promise<CurrencyRateResponseDto> {
    const rate = await this.service.createRateEntry(dto, session.userId);
    return CurrencyRateResponseDto.fromEntity(rate);
  }

  @Get('rates/latest')
  @ApiQuery({ name: 'currencyId', required: false })
  @ApiOperation({ summary: 'Get latest currency rate entries' })
  async getLatestRates(
    @Query('currencyId') currencyId?: string,
  ): Promise<CurrencyRateResponseDto[]> {
    const rates = await this.service.findLatestRates(currencyId);
    return rates.map(CurrencyRateResponseDto.fromEntity);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview a computed currency rate' })
  async preview(
    @Body() dto: PreviewCurrencyRateDto,
  ): Promise<CurrencyRateQuoteResponseDto> {
    return CurrencyRateQuoteResponseDto.fromValue(await this.service.previewQuote(dto));
  }

  @Get('product-rules')
  @ApiOperation({ summary: 'Get all product currency pricing rules' })
  async getProductCurrencyRules(
    @Query('productId') productId?: string,
    @Query('currencyId') currencyId?: string,
  ): Promise<ProductCurrencyRateResponseDto[]> {
    const rules = await this.service.findProductCurrencyRates(productId, currencyId);
    return rules.map(rule => Object.assign(new ProductCurrencyRateResponseDto(), rule));
  }

  @Post('product-rules')
  @ApiOperation({ summary: 'Create a product currency pricing rule' })
  async createProductCurrencyRule(
    @Body() dto: CreateProductCurrencyRateDto,
    @Session() session: { userId: string },
  ): Promise<ProductCurrencyRateResponseDto> {
    return Object.assign(
      new ProductCurrencyRateResponseDto(),
      await this.service.createProductCurrencyRate(dto, session.userId),
    );
  }

  @Put('product-rules/:id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update a product currency pricing rule' })
  async updateProductCurrencyRule(
    @Param('id') id: string,
    @Body() dto: UpdateProductCurrencyRateDto,
    @Session() session: { userId: string },
  ): Promise<ProductCurrencyRateResponseDto> {
    return Object.assign(
      new ProductCurrencyRateResponseDto(),
      await this.service.updateProductCurrencyRate(id, dto, session.userId),
    );
  }

  @Get('context/:productId/:currencyId')
  @ApiParam({ name: 'productId' })
  @ApiParam({ name: 'currencyId' })
  @ApiOperation({ summary: 'Get rate context for a currency' })
  async getContext(
    @Param('productId') productId: string,
    @Param('currencyId') currencyId: string,
  ) {
    const context = await this.service.getCurrencyRateContext(productId, currencyId);
    return {
      productId: context.product.id,
      productCode: context.product.productCode,
      currencyId: context.currency.id,
      currencyCode: context.currency.currencyCode,
      effectiveSource: context.effectiveSource,
      effectiveGroupCode: context.effectiveGroupCode,
      hasOverride: context.hasOverride,
    };
  }
}
