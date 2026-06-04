import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Session,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CurrencyResponseDto } from './dto/currency-response.dto';

@ApiTags('currencies')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all currencies' })
  @ApiResponse({
    status: 200,
    description: 'List of currencies',
    type: [CurrencyResponseDto],
  })
  async findAll(): Promise<CurrencyResponseDto[]> {
    return this.currencyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get currency by ID' })
  @ApiParam({ name: 'id', description: 'Currency UUID' })
  @ApiResponse({ status: 200, description: 'Currency details', type: CurrencyResponseDto })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async findById(@Param('id') id: string): Promise<CurrencyResponseDto> {
    return this.currencyService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new currency' })
  @ApiResponse({ status: 201, description: 'Currency created', type: CurrencyResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Conflict - Duplicate currency code' })
  async create(
    @Body() dto: CreateCurrencyDto,
    @Session() session: any,
  ): Promise<CurrencyResponseDto> {
    return this.currencyService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a currency' })
  @ApiParam({ name: 'id', description: 'Currency UUID' })
  @ApiResponse({ status: 200, description: 'Currency updated', type: CurrencyResponseDto })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Duplicate currency code' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCurrencyDto,
    @Session() session: any,
  ): Promise<CurrencyResponseDto> {
    return this.currencyService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a currency' })
  @ApiParam({ name: 'id', description: 'Currency UUID' })
  @ApiResponse({ status: 200, description: 'Currency deleted' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.currencyService.delete(id);
  }
}
