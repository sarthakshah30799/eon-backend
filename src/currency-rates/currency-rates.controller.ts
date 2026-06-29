import { Body, Controller, Get, Param, Post, Put, Query, Session, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrencyRatesService } from './currency-rates.service';
import { CreateCurrencyRateGroupDto } from './dto/create-currency-rate-group.dto';
import { UpdateCurrencyRateGroupDto } from './dto/update-currency-rate-group.dto';
import { SaveCurrencyRateSettingsDto } from './dto/save-currency-rate-settings.dto';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { PreviewCurrencyRateDto } from './dto/preview-currency-rate.dto';
import { CurrencyRateGroupResponseDto } from './dto/currency-rate-group-response.dto';
import { CurrencyRateResponseDto } from './dto/currency-rate-response.dto';
import { CurrencyRateQuoteResponseDto } from './dto/currency-rate-quote-response.dto';
import { CurrencyRateSettingsResponseDto } from './dto/currency-rate-settings-response.dto';

@ApiTags('currency-rates')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('currency-rates')
export class CurrencyRatesController {
  constructor(private readonly service: CurrencyRatesService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get currency rate settings' })
  @ApiResponse({ status: 200, type: CurrencyRateSettingsResponseDto })
  async getSettings(): Promise<CurrencyRateSettingsResponseDto> {
    return { config: await this.service.getSettings() };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update currency rate settings' })
  @ApiResponse({ status: 200, type: CurrencyRateSettingsResponseDto })
  async updateSettings(
    @Body() dto: SaveCurrencyRateSettingsDto,
    @Session() session: any,
  ): Promise<CurrencyRateSettingsResponseDto> {
    return { config: await this.service.updateSettings(dto, session.userId) };
  }

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
    @Session() session: any,
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
    @Session() session: any,
  ): Promise<CurrencyRateGroupResponseDto> {
    const group = await this.service.updateGroup(id, dto, session.userId);
    return CurrencyRateGroupResponseDto.fromEntity(group);
  }

  @Post('rates')
  @ApiOperation({ summary: 'Create a manual currency rate entry' })
  async createRateEntry(
    @Body() dto: CreateCurrencyRateDto,
    @Session() session: any,
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

  @Get('context/:currencyId')
  @ApiParam({ name: 'currencyId' })
  @ApiOperation({ summary: 'Get rate context for a currency' })
  async getContext(@Param('currencyId') currencyId: string) {
    const context = await this.service.getCurrencyRateContext(currencyId);
    return {
      currencyId: context.currency.id,
      currencyCode: context.currency.currencyCode,
      pricingGroup: context.currency.pricingGroup
        ? { id: context.currency.pricingGroup.id, code: context.currency.pricingGroup.code, name: context.currency.pricingGroup.name }
        : null,
      effectiveSource: context.effectiveSource,
      hasOverride: context.hasOverride,
    };
  }
}
