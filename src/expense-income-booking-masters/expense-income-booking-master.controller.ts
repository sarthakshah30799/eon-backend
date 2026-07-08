import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Session,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateExpenseIncomeBookingMasterDto, BookingMasterType } from './dto/create-expense-income-booking-master.dto';
import { ExpenseIncomeBookingMasterListQueryDto } from './dto/expense-income-booking-master-list-query.dto';
import { UpdateExpenseIncomeBookingMasterDto } from './dto/update-expense-income-booking-master.dto';
import { ExpenseIncomeBookingMasterResponseDto } from './dto/expense-income-booking-master-response.dto';
import { ExpenseIncomeBookingMasterService } from './expense-income-booking-master.service';

@ApiTags('expense-income-booking-masters')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('expense-income-booking-masters')
export class ExpenseIncomeBookingMasterController {
  constructor(private readonly service: ExpenseIncomeBookingMasterService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Expense/Income Booking Masters' })
  @ApiQuery({ name: 'type', enum: BookingMasterType, required: false, description: 'Filter by type' })
  @ApiQuery({ name: 'search', required: false, description: 'Global search across code and description' })
  @ApiResponse({ status: 200, type: [ExpenseIncomeBookingMasterResponseDto] })
  async findAll(
    @Query() query: ExpenseIncomeBookingMasterListQueryDto,
  ): Promise<ExpenseIncomeBookingMasterResponseDto[]> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Expense/Income Booking Master by ID' })
  @ApiParam({ name: 'id', description: 'Booking Master UUID' })
  @ApiResponse({ status: 200, type: ExpenseIncomeBookingMasterResponseDto })
  async findById(@Param('id') id: string): Promise<ExpenseIncomeBookingMasterResponseDto> {
    return this.service.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an Expense/Income Booking Master' })
  @ApiResponse({ status: 201, type: ExpenseIncomeBookingMasterResponseDto })
  async create(
    @Body() dto: CreateExpenseIncomeBookingMasterDto,
    @Session() session: any,
  ): Promise<ExpenseIncomeBookingMasterResponseDto> {
    return this.service.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an Expense/Income Booking Master' })
  @ApiParam({ name: 'id', description: 'Booking Master UUID' })
  @ApiResponse({ status: 200, type: ExpenseIncomeBookingMasterResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseIncomeBookingMasterDto,
    @Session() session: any,
  ): Promise<ExpenseIncomeBookingMasterResponseDto> {
    return this.service.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Expense/Income Booking Master' })
  @ApiParam({ name: 'id', description: 'Booking Master UUID' })
  @ApiResponse({ status: 200, description: 'Delete success message' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.service.delete(id);
  }
}
