import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Session } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { CounterService } from './counter.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { CounterResponseDto } from './dto/counter-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';

@ApiTags('counters')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('counters')
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  @Get()
  @ApiOperation({ summary: 'Get all counters' })
  @ApiResponse({ status: 200, description: 'List of counters', type: [CounterResponseDto] })
  async findAll(): Promise<CounterResponseDto[]> {
    return this.counterService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get counter by ID' })
  @ApiParam({ name: 'id', description: 'Counter UUID' })
  @ApiResponse({ status: 200, description: 'Counter details', type: CounterResponseDto })
  @ApiResponse({ status: 404, description: 'Counter not found' })
  async findById(@Param('id') id: string): Promise<CounterResponseDto> {
    return this.counterService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new counter' })
  @ApiResponse({ status: 201, description: 'Counter created', type: CounterResponseDto })
  async create(@Body() dto: CreateCounterDto, @Session() session: any): Promise<CounterResponseDto> {
    return this.counterService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a counter' })
  @ApiParam({ name: 'id', description: 'Counter UUID' })
  @ApiResponse({ status: 200, description: 'Counter updated', type: CounterResponseDto })
  @ApiResponse({ status: 404, description: 'Counter not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCounterDto,
    @Session() session: any,
  ): Promise<CounterResponseDto> {
    return this.counterService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a counter' })
  @ApiParam({ name: 'id', description: 'Counter UUID' })
  @ApiResponse({ status: 200, description: 'Counter deleted' })
  @ApiResponse({ status: 404, description: 'Counter not found' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.counterService.delete(id);
  }
}
