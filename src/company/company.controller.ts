import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Session,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { UserService } from '../users/user.service';

@ApiTags('companies')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('companies')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all companies' })
  @ApiResponse({ status: 200, description: 'List of companies', type: [CompanyResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(): Promise<CompanyResponseDto[]> {
    return this.companyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company by ID' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company details', type: CompanyResponseDto })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findById(@Param('id') id: string): Promise<CompanyResponseDto> {
    return this.companyService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({ status: 201, description: 'Company created', type: CompanyResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() dto: CreateCompanyDto, @Session() session: any): Promise<CompanyResponseDto> {
    const user = await this.userService.findById(session.userId);
    if (!user.isAdmin) {
      throw new ForbiddenException('Only admin users can create company profiles');
    }
    return this.companyService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a company' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company updated', type: CompanyResponseDto })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @Session() session: any,
  ): Promise<CompanyResponseDto> {
    const user = await this.userService.findById(session.userId);
    if (!user.isAdmin) {
      throw new ForbiddenException('Only admin users can update company profiles');
    }
    return this.companyService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a company' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company deleted' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(@Param('id') id: string, @Session() session: any): Promise<{ message: string }> {
    const user = await this.userService.findById(session.userId);
    if (!user.isAdmin) {
      throw new ForbiddenException('Only admin users can delete company profiles');
    }
    return this.companyService.delete(id);
  }
}
